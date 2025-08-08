import axios from 'axios';

export class TextToSpeechEngine {
  private elevenLabsApiKey?: string;
  private voiceId: string;
  private maxChars: number = 5000;
  private lastApiCall: number = 0;
  private minDelay: number = 1000;
  private audioProcessor: any = null;
  private onSpeakingStartCallback: (() => void) | null = null;
  private onSpeakingEndCallback: (() => void) | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private isMobile: boolean = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  private isAndroid: boolean = /Android/i.test(navigator.userAgent);

  constructor(elevenLabsApiKey?: string, voiceId: string = "21m00Tcm4TlvDq8ikWAM") {
    this.elevenLabsApiKey = elevenLabsApiKey;
    this.voiceId = voiceId;
    console.log(`TextToSpeechEngine initialized with voice_id: ${voiceId}, API key provided: ${!!elevenLabsApiKey}, Mobile: ${this.isMobile}`);
    
    // Set up audio context for mobile
    if (this.isAndroid) {
      this.initializeAudioContext();
    }
  }

  private initializeAudioContext() {
    // Create a silent audio context to enable audio on Android
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      gainNode.gain.value = 0; // Silent
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.01);
      
      console.log('Audio context initialized for Android');
    } catch (error) {
      console.warn('Could not initialize audio context:', error);
    }
  }

  setAudioProcessor(processor: any) {
    this.audioProcessor = processor;
  }

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

  private async speakWithElevenLabs(text: string): Promise<boolean> {
    try {
      console.log(`Attempting to use Eleven Labs API for text: ${text.substring(0, 50)}...`);
      
      // Enforce minimum delay to avoid rate limits
      const elapsed = Date.now() - this.lastApiCall;
      if (elapsed < this.minDelay) {
        await new Promise(resolve => setTimeout(resolve, this.minDelay - elapsed));
      }

      const url = `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`;
      const headers = {
        'xi-api-key': this.elevenLabsApiKey!,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      };

      const data = {
        text: text,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        }
      };

      const response = await axios.post(url, data, {
        headers,
        timeout: 30000, // Longer timeout for mobile
        responseType: 'blob'
      });

      this.lastApiCall = Date.now();

      if (response.status === 200) {
        // Stop any current audio
        if (this.currentAudio) {
          this.currentAudio.pause();
          this.currentAudio = null;
        }

        // Create audio element with Android-specific settings
        const audioBlob = new Blob([response.data], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio();
        
        // Android-specific audio settings
        audio.preload = 'auto';
        audio.volume = this.isAndroid ? 1.0 : 0.8; // Full volume on Android
        audio.crossOrigin = 'anonymous';
        
        // Handle Android-specific audio loading
        if (this.isAndroid) {
          audio.load(); // Explicitly load on Android
        }
        
        this.currentAudio = audio;
        
        await new Promise<void>((resolve, reject) => {
          const cleanup = () => {
            URL.revokeObjectURL(audioUrl);
            if (this.currentAudio === audio) {
              this.currentAudio = null;
            }
          };

          audio.onended = () => {
            cleanup();
            resolve();
          };
          
          audio.onerror = (error) => {
            console.error('Audio playback error:', error);
            cleanup();
            reject(error);
          };

          audio.oncanplaythrough = () => {
            console.log('Audio can play through');
          };

          audio.src = audioUrl;
          
          // Android-specific play handling
          const playPromise = audio.play();
          if (playPromise) {
            playPromise.catch(error => {
              console.error('Play promise rejected:', error);
              cleanup();
              reject(error);
            });
          }
        });

        console.log('Successfully played audio with Eleven Labs');
        return true;
      } else {
        console.error(`Eleven Labs API error: ${response.status}`);
        return false;
      }
    } catch (error) {
      console.error('Error with Eleven Labs API:', error);
      return false;
    }
  }

  private async speakWithWebSpeech(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        reject(new Error('Speech synthesis not supported'));
        return;
      }

      // Cancel any ongoing speech
      speechSynthesis.cancel();

      // Wait for voices to load (especially important on Android)
      const speakWhenReady = () => {
        const voices = speechSynthesis.getVoices();
        console.log(`Available voices: ${voices.length}`);

        const utterance = new SpeechSynthesisUtterance(text);
        
        // Android-optimized settings
        utterance.rate = this.isAndroid ? 0.8 : 0.9; // Slower on Android
        utterance.pitch = 1;
        utterance.volume = 1; // Full volume on Android
        
        // Try to use a good English voice
        const englishVoices = voices.filter(voice => 
          voice.lang.startsWith('en') && 
          (voice.name.includes('Google') || voice.name.includes('Chrome') || voice.default)
        );
        
        if (englishVoices.length > 0) {
          utterance.voice = englishVoices[0];
          console.log(`Using voice: ${utterance.voice.name}`);
        }

        utterance.onend = () => {
          console.log('Web Speech synthesis ended');
          resolve();
        };
        
        utterance.onerror = (event) => {
          console.error('Web Speech synthesis error:', event);
          reject(event.error);
        };

        utterance.onstart = () => {
          console.log('Web Speech synthesis started');
        };

        // Android-specific speech handling
        if (this.isAndroid) {
          // Ensure speech synthesis is ready
          if (speechSynthesis.speaking) {
            speechSynthesis.cancel();
          }
          
          // Additional delay for Android
          setTimeout(() => {
            try {
              speechSynthesis.speak(utterance);
              console.log(`Speaking with Web Speech API on Android: ${text.substring(0, 50)}...`);
            } catch (error) {
              console.error('Error starting speech on Android:', error);
              reject(error);
            }
          }, 200);
        } else {
          speechSynthesis.speak(utterance);
          console.log(`Speaking with Web Speech API: ${text.substring(0, 50)}...`);
        }
      };

      // Check if voices are already loaded
      const voices = speechSynthesis.getVoices();
      if (voices.length > 0) {
        speakWhenReady();
      } else {
        // Wait for voices to load (important on Android Chrome)
        speechSynthesis.onvoiceschanged = () => {
          speechSynthesis.onvoiceschanged = null;
          speakWhenReady();
        };
        
        // Fallback timeout in case onvoiceschanged doesn't fire
        setTimeout(() => {
          if (speechSynthesis.onvoiceschanged) {
            speechSynthesis.onvoiceschanged = null;
            speakWhenReady();
          }
        }, 1000);
      }
    });
  }

  async speakText(text: string, pauseRecording: boolean = true): Promise<void> {
    if (!text || text.trim() === "") {
      console.warn('No valid text provided for TTS');
      throw new Error('No text to speak');
    }

    console.log(`Processing text for TTS on ${this.isAndroid ? 'Android' : 'other'}: ${text}`);

    // Notify that AI is starting to speak
    this.onSpeakingStartCallback?.();

    // Always pause recording during TTS to prevent feedback
    if (this.audioProcessor) {
      this.audioProcessor.pauseRecording();
    }

    try {
      if (this.elevenLabsApiKey) {
        const chunks = this.splitText(text);
        let success = true;

        for (let i = 0; i < chunks.length; i++) {
          console.log(`Speaking chunk ${i + 1}/${chunks.length}: ${chunks[i].substring(0, 50)}...`);
          if (!(await this.speakWithElevenLabs(chunks[i]))) {
            success = false;
            break;
          }
          
          // Add delay between chunks on Android
          if (this.isAndroid && i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        if (!success) {
          console.warn('Falling back to Web Speech API due to Eleven Labs failure');
          await this.speakWithWebSpeech(text);
        }
      } else {
        console.warn('No Eleven Labs API key provided, using Web Speech API');
        await this.speakWithWebSpeech(text);
      }
    } finally {
      // Notify that AI has finished speaking
      this.onSpeakingEndCallback?.();

      // Resume recording with longer delay on mobile
      const delay = this.isAndroid ? 3000 : (this.isMobile ? 2000 : 1000);
      
      setTimeout(() => {
        if (this.audioProcessor) {
          this.audioProcessor.resumeRecording();
          
          // On mobile, don't auto-restart - require user interaction
          if (this.isMobile) {
            console.log('Mobile: Speech recognition resumed but needs manual restart');
          }
        }
      }, delay);
    }
  }

  // Method to stop any current audio playback
  stopSpeaking(): void {
    // Stop Eleven Labs audio
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    
    // Stop Web Speech API
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    
    // Notify that speaking has ended
    this.onSpeakingEndCallback?.();
  }
}