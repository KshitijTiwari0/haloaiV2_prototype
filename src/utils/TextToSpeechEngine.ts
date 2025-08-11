import axios from 'axios';
import { AudioProcessor } from './AudioProcessor';
import { SupportedLanguage } from '../types';

export class TextToSpeechEngine {
  private elevenLabsApiKey: string;
  private voiceId: string;
  private maxChars: number = 5000;
  private lastApiCall: number = 0;
  private minDelay: number = 1000;
  private audioProcessor: AudioProcessor | null = null;
  private onSpeakingStartCallback: (() => void) | null = null;
  private onSpeakingEndCallback: (() => void) | null = null;

  // Voice mapping for different languages
  private readonly voiceMapping = {
    'en': '21m00Tcm4TlvDq8ikWAM', // Default English voice
    'hi': 'yRis6UiS4dtT4Aqv72DC', // Ranbir M - Deep, Engaging Hindi Voice
    'ar': 'tavIIPLplRB883FzWU0V'  // Mona - Middle-aged Female with Arabic Modern Standard accent
  };

  constructor(elevenLabsApiKey: string, voiceId: string = "21m00Tcm4TlvDq8ikWAM") {
    if (!elevenLabsApiKey) {
      throw new Error('Eleven Labs API key is required');
    }
    
    this.elevenLabsApiKey = elevenLabsApiKey;
    this.voiceId = voiceId;
    console.log(`TextToSpeechEngine initialized with voice_id: ${voiceId}`);
  }

  // Add method to set audio processor reference
  setAudioProcessor(processor: AudioProcessor) {
    this.audioProcessor = processor;
  }

  // Add methods to set speaking callbacks
  setOnSpeakingStart(callback: () => void) {
    this.onSpeakingStartCallback = callback;
  }

  setOnSpeakingEnd(callback: () => void) {
    this.onSpeakingEndCallback = callback;
  }

  // Get voice ID for specific language
  getVoiceForLanguage(language: SupportedLanguage): string {
    if (language === 'auto') {
      return this.voiceMapping.en; // Default to English
    }
    return this.voiceMapping[language] || this.voiceMapping.en;
  }

  // Auto-select voice based on detected language
  private selectVoiceForText(text: string, detectedLanguage?: string): string {
    if (detectedLanguage && detectedLanguage !== 'auto') {
      const voiceId = this.getVoiceForLanguage(detectedLanguage as SupportedLanguage);
      console.log(`Auto-selected voice for language ${detectedLanguage}: ${voiceId}`);
      return voiceId;
    }

    // Fallback: detect language from text patterns
    const arabicPattern = /[\u0600-\u06FF]/;
    const hindiPattern = /[\u0900-\u097F]/;
    
    if (arabicPattern.test(text)) {
      console.log('Detected Arabic text, using Arabic voice');
      return this.voiceMapping.ar;
    } else if (hindiPattern.test(text)) {
      console.log('Detected Hindi text, using Hindi voice');
      return this.voiceMapping.hi;
    } else {
      console.log('Detected English text or fallback, using English voice');
      return this.voiceMapping.en;
    }
  }

  private splitText(text: string): string[] {
    if (text.length <= this.maxChars) {
      return [text];
    }

    const chunks: string[] = [];
    let currentChunk = "";
    
    // Use different sentence delimiters based on language
    const arabicPattern = /[\u0600-\u06FF]/;
    const hindiPattern = /[\u0900-\u097F]/;
    
    let sentenceDelimiter = '. ';
    if (arabicPattern.test(text)) {
      sentenceDelimiter = '۔ '; // Arabic sentence delimiter
    } else if (hindiPattern.test(text)) {
      sentenceDelimiter = '। '; // Hindi sentence delimiter (Devanagari danda)
    }
    
    const sentences = text.split(sentenceDelimiter);

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length + sentenceDelimiter.length <= this.maxChars) {
        currentChunk += sentence + sentenceDelimiter;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = sentence + sentenceDelimiter;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  private async speakWithElevenLabs(text: string, voiceId?: string): Promise<void> {
    const selectedVoiceId = voiceId || this.voiceId;
    
    try {
      console.log(`Using Eleven Labs API with voice_id: ${selectedVoiceId} for text: ${text.substring(0, 50)}...`);
      
      // Enforce minimum delay to avoid rate limits
      const elapsed = Date.now() - this.lastApiCall;
      if (elapsed < this.minDelay) {
        await new Promise(resolve => setTimeout(resolve, this.minDelay - elapsed));
      }

      const url = `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`;
      const headers = {
        'xi-api-key': this.elevenLabsApiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      };

      // Enhanced voice settings for multilingual support
      const data = {
        text: text,
        model_id: "eleven_multilingual_v2", // Use multilingual model
        voice_settings: {
          stability: 0.6, // Slightly higher for multilingual
          similarity_boost: 0.7, // Higher for better accent preservation
          style: 0.2, // Add some style for natural speech
          use_speaker_boost: true
        }
      };

      const response = await axios.post(url, data, {
        headers,
        timeout: 30000,
        responseType: 'blob'
      });

      this.lastApiCall = Date.now();

      if (response.status === 200) {
        // Create audio element and play
        const audioBlob = new Blob([response.data], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        // Optimized audio settings
        audio.preload = 'auto';
        audio.volume = 0.9;
        
        await new Promise((resolve, reject) => {
          const cleanup = () => {
            URL.revokeObjectURL(audioUrl);
          };

          audio.onended = () => {
            cleanup();
            resolve(void 0);
          };
          
          audio.onerror = (error) => {
            cleanup();
            reject(new Error('Audio playback failed'));
          };

          audio.oncanplaythrough = () => {
            audio.play().catch(reject);
          };

          audio.load();
        });

        console.log(`Successfully played audio with Eleven Labs (voice: ${selectedVoiceId})`);
      } else {
        throw new Error(`Eleven Labs API error: ${response.status}`);
      }
    } catch (error) {
      console.error('Error with Eleven Labs API:', error);
      
      // Enhanced error handling
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('Invalid Eleven Labs API key');
        } else if (error.response?.status === 429) {
          throw new Error('Eleven Labs rate limit exceeded. Please try again later.');
        } else if (error.response?.status === 422) {
          throw new Error('Invalid text or voice settings for Eleven Labs');
        }
      }
      
      throw new Error('Failed to generate speech with Eleven Labs');
    }
  }

  async speakText(text: string, pauseRecording: boolean = true, detectedLanguage?: string): Promise<void> {
    if (!text || text.trim() === "") {
      console.warn('No valid text provided for TTS');
      throw new Error('No text to speak');
    }

    // Clean text for TTS - preserve language-specific characters
    const cleanText = text
      .replace(/[*_~`#]/g, '') // Remove markdown formatting
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    console.log(`Processing text for TTS (${detectedLanguage || 'auto-detect'}): ${cleanText}`);

    // Auto-select appropriate voice based on detected language or text content
    const selectedVoiceId = this.selectVoiceForText(cleanText, detectedLanguage);

    // Notify that AI is starting to speak
    this.onSpeakingStartCallback?.();

    // Always pause recording during TTS to prevent feedback
    if (this.audioProcessor && pauseRecording) {
      this.audioProcessor.pauseRecording();
    }

    try {
      const chunks = this.splitText(cleanText);

      for (let i = 0; i < chunks.length; i++) {
        console.log(`Speaking chunk ${i + 1}/${chunks.length} (${detectedLanguage}): ${chunks[i].substring(0, 50)}...`);
        await this.speakWithElevenLabs(chunks[i], selectedVoiceId);
        
        // Small delay between chunks to prevent audio overlap
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

    } catch (error) {
      console.error('TTS Error:', error);
      throw error;
    } finally {
      // Notify that AI has finished speaking
      this.onSpeakingEndCallback?.();

      // Resume recording with appropriate delay
      if (this.audioProcessor && pauseRecording) {
        const delay = 1500; // 1.5 seconds to ensure clean audio separation
        
        setTimeout(() => {
          this.audioProcessor?.resumeRecording();
        }, delay);
      }
    }
  }

  // Method to check if Eleven Labs API key is valid
  async validateApiKey(): Promise<boolean> {
    try {
      const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
        headers: {
          'xi-api-key': this.elevenLabsApiKey
        },
        timeout: 10000
      });
      
      return response.status === 200;
    } catch (error) {
      console.error('Eleven Labs API key validation failed:', error);
      return false;
    }
  }

  // Method to get available voices with language information
  async getAvailableVoices(): Promise<any[]> {
    try {
      const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
        headers: {
          'xi-api-key': this.elevenLabsApiKey
        },
        timeout: 10000
      });
      
      const voices = response.data.voices || [];
      
      // Add language metadata to our specific voices
      return voices.map((voice: any) => ({
        ...voice,
        language: this.getLanguageForVoice(voice.voice_id),
        is_multilingual: voice.voice_id === this.voiceMapping.en || 
                        voice.voice_id === this.voiceMapping.hi || 
                        voice.voice_id === this.voiceMapping.ar
      }));
    } catch (error) {
      console.error('Error fetching voices:', error);
      return [];
    }
  }

  // Helper method to get language for a voice ID
  private getLanguageForVoice(voiceId: string): string {
    for (const [lang, id] of Object.entries(this.voiceMapping)) {
      if (id === voiceId) {
        return lang;
      }
    }
    return 'unknown';
  }

  // Method to change voice for specific language
  setVoiceForLanguage(language: SupportedLanguage, voiceId: string) {
    if (language !== 'auto') {
      (this.voiceMapping as any)[language] = voiceId;
      console.log(`Voice for ${language} changed to: ${voiceId}`);
    }
  }

  // Method to change default voice
  setVoiceId(newVoiceId: string) {
    this.voiceId = newVoiceId;
    console.log(`Default voice changed to: ${newVoiceId}`);
  }

  // Method to get current voice ID
  getVoiceId(): string {
    return this.voiceId;
  }

  // Get all voice mappings
  getVoiceMappings(): Record<string, string> {
    return { ...this.voiceMapping };
  }

  // Test voice with sample text in different languages
  async testVoice(language: SupportedLanguage): Promise<void> {
    const testTexts = {
      'en': 'Hello! This is a test of the English voice.',
      'hi': 'नमस्ते! यह हिंदी आवाज़ का परीक्षण है।',
      'ar': 'مرحبا! هذا اختبار للصوت العربي.',
      'auto': 'Hello! This is a test message.'
    };
    
    const testText = testTexts[language];
    const voiceId = this.getVoiceForLanguage(language);
    
    console.log(`Testing ${language} voice (${voiceId}): ${testText}`);
    await this.speakText(testText, false, language === 'auto' ? undefined : language);
  }
}