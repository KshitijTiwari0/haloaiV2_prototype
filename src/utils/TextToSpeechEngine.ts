// Add these methods to your TextToSpeechEngine class

export class TextToSpeechEngine {
  private elevenLabsApiKey?: string;
  private voiceId: string;
  private maxChars: number = 5000;
  private lastApiCall: number = 0;
  private minDelay: number = 1000;
  private audioProcessor: AudioProcessor | null = null; // Add reference to audio processor

  constructor(elevenLabsApiKey?: string, voiceId: string = "21m00Tcm4TlvDq8ikWAM") {
    this.elevenLabsApiKey = elevenLabsApiKey;
    this.voiceId = voiceId;
    console.log(`TextToSpeechEngine initialized with voice_id: ${voiceId}, API key provided: ${!!elevenLabsApiKey}`);
  }

  // Add method to set audio processor reference
  setAudioProcessor(processor: AudioProcessor) {
    this.audioProcessor = processor;
  }

  // Modified speakText method with mobile audio handling
  async speakText(text: string, pauseRecording: boolean = true): Promise<void> {
    if (!text || text.trim() === "") {
      console.warn('No valid text provided for TTS');
      throw new Error('No text to speak');
    }

    console.log(`Processing text for TTS: ${text}`);

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
      // Resume recording with longer delay on mobile
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const delay = isMobile ? 2000 : 1000; // 2 seconds on mobile, 1 second on desktop
      
      setTimeout(() => {
        if (this.audioProcessor) {
          this.audioProcessor.resumeRecording();
          // On mobile, manually restart recognition
          if (isMobile) {
            setTimeout(() => {
              (this.audioProcessor as any).restartRecognition?.();
            }, 500);
          }
        }
      }, delay);
    }
  }

  // Rest of your existing methods...
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
      
      const elapsed = Date.now() - this.lastApiCall;
      if (elapsed < this.minDelay) {
        await new Promise(resolve => setTimeout(resolve, this.minDelay - elapsed));
      }

      const url = `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': this.elevenLabsApiKey!,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5
          }
        })
      });

      this.lastApiCall = Date.now();

      if (response.ok) {
        const audioBlob = new Blob([await response.arrayBuffer()], { type: 'audio/mpeg' });
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
          
          // Handle mobile audio play restrictions
          audio.play().catch(error => {
            console.error('Audio play error:', error);
            reject(error);
          });
        });

        return true;
      }
      return false;
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
}