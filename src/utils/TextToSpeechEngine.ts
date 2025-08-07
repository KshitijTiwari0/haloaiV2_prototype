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

  constructor(elevenLabsApiKey?: string, voiceId: string = "21m00Tcm4TlvDq8ikWAM") {
    this.elevenLabsApiKey = elevenLabsApiKey;
    this.voiceId = voiceId;
    console.log(`TextToSpeechEngine initialized with voice_id: ${voiceId}, API key provided: ${!!elevenLabsApiKey}`);
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

  private async speakWithElevenLabs(text: string): Promise<boolean> {
    try {
      console.log(`Attempting to use Eleven Labs API with voice_id: ${this.voiceId} for text: ${text.substring(0, 50)}...`);
      
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
        timeout: 20000,
        responseType: 'blob'
      });

      this.lastApiCall = Date.now();

      if (response.status === 200) {
        // Create audio element and play
        const audioBlob = new Blob([response.data], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        // Mobile-specific audio settings
        audio.preload = 'auto';
        audio.volume = 0.8; // Slightly lower volume for mobile
        
        await new Promise((resolve, reject) => {
          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            resolve(void 0);
          };
          audio.onerror = reject;
          audio.play();
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

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9; // Slightly slower for mobile
      utterance.pitch = 1;
      utterance.volume = 0.8; // Lower volume for mobile

      utterance.onend = () => resolve();
      utterance.onerror = (event) => reject(event.error);

      // Mobile-specific: ensure speech synthesis is ready
      if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
      }

      setTimeout(() => {
        speechSynthesis.speak(utterance);
      }, 100);

      console.log(`Speaking with Web Speech API: ${text}`);
    });
  }

  async speakText(text: string, pauseRecording: boolean = true): Promise<void> {
    if (!text || text.trim() === "") {
      console.warn('No valid text provided for TTS');
      throw new Error('No text to speak');
    }

    console.log(`Processing text for TTS: ${text}`);

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
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const delay = isMobile ? 2000 : 1000; // 2 seconds on mobile, 1 second on desktop
      
      setTimeout(() => {
        if (this.audioProcessor) {
          this.audioProcessor.resumeRecording();
          // On mobile, manually restart recognition
          if (isMobile) {
            setTimeout(() => {
              this.audioProcessor?.restartRecognition?.();
            }, 500);
          }
        }
      }, delay);
    }
  }
}