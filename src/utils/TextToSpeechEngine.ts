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
  private isIOS: boolean;
  private audioContext: AudioContext | null = null;

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
    
    // Detect iOS
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                 (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    console.log(`TextToSpeechEngine initialized for ${this.isIOS ? 'iOS' : 'Desktop'} with voice_id: ${voiceId}`);
  }

  private async initializeAudioContext(): Promise<AudioContext> {
    if (!this.audioContext) {
      // Use webkit prefix for iOS compatibility
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();
    }

    // iOS requires user interaction to resume audio context
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    return this.audioContext;
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
      
      // Enforce minimum delay to avoid rate limits (longer for iOS)
      const minDelay = this.isIOS ? 1500 : this.minDelay;
      const elapsed = Date.now() - this.lastApiCall;
      if (elapsed < minDelay) {
        await new Promise(resolve => setTimeout(resolve, minDelay - elapsed));
      }

      const url = `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`;
      const headers = {
        'xi-api-key': this.elevenLabsApiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      };

      const data = {
        text: text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: this.isIOS ? 0.7 : 0.6, // Higher stability for iOS
          similarity_boost: this.isIOS ? 0.8 : 0.7, // Higher boost for iOS
          style: 0.2,
          use_speaker_boost: true
        }
      };

      // iOS needs longer timeout
      const timeoutMs = this.isIOS ? 60000 : 30000;
      
      const response = await axios.post(url, data, {
        headers,
        timeout: timeoutMs,
        responseType: 'blob'
      });

      this.lastApiCall = Date.now();

      if (response.status === 200) {
        await this.playAudioBlob(response.data);
        console.log(`Successfully played audio with Eleven Labs (voice: ${selectedVoiceId})`);
      } else {
        throw new Error(`Eleven Labs API error: ${response.status}`);
      }
    } catch (error) {
      console.error('Error with Eleven Labs API:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error('Audio generation timeout - please try again');
        }
        if (error.response?.status === 401) {
          throw new Error('Invalid Eleven Labs API key');
        } else if (error.response?.status === 429) {
          throw new Error('Eleven Labs rate limit exceeded. Please try again later.');
        }
      }
      
      // Fallback to Web Speech API on iOS if Eleven Labs fails
      if (this.isIOS) {
        console.log('Falling back to Web Speech API on iOS');
        await this.speakWithWebSpeech(text);
        return;
      }
      
      throw new Error('Failed to generate speech with Eleven Labs');
    }
  }

  private async playAudioBlob(audioBlob: Blob): Promise<void> {
    if (this.isIOS) {
      // Use AudioContext for better iOS compatibility
      await this.playWithAudioContext(audioBlob);
    } else {
      // Use Audio element for desktop
      await this.playWithAudioElement(audioBlob);
    }
  }

  private async playWithAudioContext(audioBlob: Blob): Promise<void> {
    try {
      const audioContext = await this.initializeAudioContext();
      
      // Convert blob to array buffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      // Decode audio data
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Create source and connect to destination
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      
      // Play the audio
      return new Promise((resolve, reject) => {
        source.onended = () => resolve();
        source.onerror = (error) => reject(new Error('Audio playback failed'));
        
        try {
          source.start(0);
        } catch (error) {
          reject(error);
        }
      });
      
    } catch (error) {
      console.error('AudioContext playback failed:', error);
      // Fallback to audio element
      await this.playWithAudioElement(audioBlob);
    }
  }

  private async playWithAudioElement(audioBlob: Blob): Promise<void> {
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    
    // iOS-specific audio settings
    if (this.isIOS) {
      audio.preload = 'auto';
      audio.muted = false;
      audio.volume = 1.0;
      
      // Required for iOS autoplay
      audio.setAttribute('playsinline', 'true');
    } else {
      audio.preload = 'auto';
      audio.volume = 0.9;
    }
    
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        URL.revokeObjectURL(audioUrl);
      };

      audio.onended = () => {
        cleanup();
        resolve();
      };
      
      audio.onerror = (error) => {
        cleanup();
        reject(new Error('Audio playback failed'));
      };

      // iOS needs user interaction for autoplay
      if (this.isIOS) {
        audio.oncanplaythrough = () => {
          // Try to play immediately
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch(reject);
          }
        };
      } else {
        audio.oncanplaythrough = () => {
          audio.play().catch(reject);
        };
      }

      audio.load();
    });
  }

  // Fallback Web Speech API for iOS
  private async speakWithWebSpeech(text: string): Promise<void> {
    if (!('speechSynthesis' in window)) {
      throw new Error('Speech synthesis not supported');
    }

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Try to select appropriate voice for language
      const voices = speechSynthesis.getVoices();
      const arabicVoice = voices.find(voice => voice.lang.startsWith('ar'));
      const hindiVoice = voices.find(voice => voice.lang.startsWith('hi'));
      const englishVoice = voices.find(voice => voice.lang.startsWith('en'));
      
      // Auto-detect language and set voice
      if (/[\u0600-\u06FF]/.test(text) && arabicVoice) {
        utterance.voice = arabicVoice;
        utterance.lang = 'ar';
      } else if (/[\u0900-\u097F]/.test(text) && hindiVoice) {
        utterance.voice = hindiVoice;
        utterance.lang = 'hi';
      } else if (englishVoice) {
        utterance.voice = englishVoice;
        utterance.lang = 'en';
      }
      
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      utterance.onend = () => resolve();
      utterance.onerror = (error) => reject(new Error(`Speech synthesis failed: ${error.error}`));
      
      speechSynthesis.speak(utterance);
    });
  }

  async speakText(text: string, pauseRecording: boolean = true, detectedLanguage?: string): Promise<void> {
    if (!text || text.trim() === "") {
      console.warn('No valid text provided for TTS');
      throw new Error('No text to speak');
    }

    const cleanText = text
      .replace(/[*_~`#]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    console.log(`Processing text for TTS on ${this.isIOS ? 'iOS' : 'Desktop'} (${detectedLanguage || 'auto-detect'}): ${cleanText}`);

    // Notify that AI is starting to speak
    this.onSpeakingStartCallback?.();

    // More aggressive recording pause for iOS
    if (this.audioProcessor && pauseRecording) {
      this.audioProcessor.pauseRecording();
      
      // Extra delay for iOS to ensure clean audio separation
      if (this.isIOS) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    try {
      const selectedVoiceId = this.selectVoiceForText(cleanText, detectedLanguage);
      const chunks = this.splitText(cleanText);

      for (let i = 0; i < chunks.length; i++) {
        console.log(`Speaking chunk ${i + 1}/${chunks.length} (${detectedLanguage}): ${chunks[i].substring(0, 50)}...`);
        
        try {
          await this.speakWithElevenLabs(chunks[i], selectedVoiceId);
        } catch (error) {
          console.error(`Eleven Labs failed for chunk ${i + 1}, trying Web Speech API:`, error);
          
          // Fallback to Web Speech API on iOS
          if (this.isIOS) {
            await this.speakWithWebSpeech(chunks[i]);
          } else {
            throw error;
          }
        }
        
        // Longer delay between chunks on iOS
        if (i < chunks.length - 1) {
          const delay = this.isIOS ? 500 : 200;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

    } catch (error) {
      console.error('TTS Error:', error);
      throw error;
    } finally {
      // Notify that AI has finished speaking
      this.onSpeakingEndCallback?.();

      // Resume recording with longer delay for iOS
      if (this.audioProcessor && pauseRecording) {
        const delay = this.isIOS ? 2500 : 1500; // Longer delay for iOS
        
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

  // Get iOS status
  getIsIOS(): boolean {
    return this.isIOS;
  }
}