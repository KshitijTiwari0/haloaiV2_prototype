import axios from 'axios';

export class TextToSpeechEngine {
  private elevenLabsApiKey: string;
  private voiceId: string;
  private maxChars: number = 5000;
  private lastApiCall: number = 0;
  private minDelay: number = 1000;
  private audioProcessor: any = null;
  private onSpeakingStartCallback: (() => void) | null = null;
  private onSpeakingEndCallback: (() => void) | null = null;

  constructor(elevenLabsApiKey: string, voiceId: string = "21m00Tcm4TlvDq8ikWAM") {
    if (!elevenLabsApiKey) {
      throw new Error('Eleven Labs API key is required');
    }
    
    this.elevenLabsApiKey = elevenLabsApiKey;
    this.voiceId = voiceId;
    console.log(`TextToSpeechEngine initialized with voice_id: ${voiceId}`);
  }

  // Add method to set audio processor reference
  setAudioProcessor(processor: any) {
    this.audioProcessor = processor;
  }

  // Add methods to set speaking callbacks
  setOnSpeakingStart(callback: () => void) {
    this.onSpeakingStartCallback = callback;
  }

  setOnSpeakingEnd(callback: () => void) {
    this.onSpeakingEndCallback = callback;
  }

  private splitText(text: string): string[] {
    if (text.length <= this.maxChars) {
      return [text];
    }

    const chunks: string[] = [];
    let currentChunk = "";
    const sentences = text.split('. ');

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length + 1 <= this.maxChars) {
        currentChunk += sentence + '. ';
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = sentence + '. ';
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  private async speakWithElevenLabs(text: string): Promise<void> {
    try {
      console.log(`Using Eleven Labs API with voice_id: ${this.voiceId} for text: ${text.substring(0, 50)}...`);
      
      // Enforce minimum delay to avoid rate limits
      const elapsed = Date.now() - this.lastApiCall;
      if (elapsed < this.minDelay) {
        await new Promise(resolve => setTimeout(resolve, this.minDelay - elapsed));
      }

      const url = `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`;
      const headers = {
        'xi-api-key': this.elevenLabsApiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      };

      const data = {
        text: text,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
          style: 0.0,
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

        console.log('Successfully played audio with Eleven Labs');
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

  async speakText(text: string, pauseRecording: boolean = true): Promise<void> {
    if (!text || text.trim() === "") {
      console.warn('No valid text provided for TTS');
      throw new Error('No text to speak');
    }

    // Clean text for TTS
    const cleanText = text
      .replace(/[*_~`#]/g, '') // Remove markdown formatting
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    console.log(`Processing text for TTS: ${cleanText}`);

    // Notify that AI is starting to speak
    this.onSpeakingStartCallback?.();

    // Always pause recording during TTS to prevent feedback
    if (this.audioProcessor && pauseRecording) {
      this.audioProcessor.pauseRecording();
    }

    try {
      const chunks = this.splitText(cleanText);

      for (let i = 0; i < chunks.length; i++) {
        console.log(`Speaking chunk ${i + 1}/${chunks.length}: ${chunks[i].substring(0, 50)}...`);
        await this.speakWithElevenLabs(chunks[i]);
        
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
          this.audioProcessor.resumeRecording();
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

  // Method to get available voices
  async getAvailableVoices(): Promise<any[]> {
    try {
      const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
        headers: {
          'xi-api-key': this.elevenLabsApiKey
        },
        timeout: 10000
      });
      
      return response.data.voices || [];
    } catch (error) {
      console.error('Error fetching voices:', error);
      return [];
    }
  }

  // Method to change voice
  setVoiceId(newVoiceId: string) {
    this.voiceId = newVoiceId;
    console.log(`Voice changed to: ${newVoiceId}`);
  }

  // Method to get current voice ID
  getVoiceId(): string {
    return this.voiceId;
  }
}