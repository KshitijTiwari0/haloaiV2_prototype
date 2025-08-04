import axios from 'axios';

export class TextToSpeechEngine {
  private elevenLabsApiKey?: string;
  private voiceId: string;
  private audioQueue: Blob[] = [];
  private isPlaying: boolean = false;
  private audio: HTMLAudioElement;
  private currentPromise: { resolve: () => void, reject: (reason?: any) => void } | null = null;

  constructor(elevenLabsApiKey?: string, voiceId: string = "21m00Tcm4TlvDq8ikWAM") {
    this.elevenLabsApiKey = elevenLabsApiKey;
    this.voiceId = voiceId;
    this.audio = new Audio();
    this.audio.onended = () => {
      this.isPlaying = false;
      this.playNextInQueue();
    };
    this.audio.onerror = (e) => {
        this.isPlaying = false;
        if(this.currentPromise) {
            this.currentPromise.reject(e);
            this.currentPromise = null;
        }
    }
    console.log(`TextToSpeechEngine initialized with voice_id: ${voiceId}, API key provided: ${!!elevenLabsApiKey}`);
  }

  private playNextInQueue() {
    if (this.audioQueue.length > 0) {
      this.isPlaying = true;
      const audioBlob = this.audioQueue.shift()!;
      const audioUrl = URL.createObjectURL(audioBlob);
      this.audio.src = audioUrl;
      this.audio.play();
    } else {
      this.isPlaying = false;
      if (this.currentPromise) {
        this.currentPromise.resolve();
        this.currentPromise = null;
      }
    }
  }

  private async speakWithElevenLabs(text: string): Promise<void> {
    try {
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`;
      const headers = {
        'xi-api-key': this.elevenLabsApiKey!,
        'Content-Type': 'application/json', 'Accept': 'audio/mpeg'
      };
      const data = {
        text: text, model_id: "eleven_monolingual_v1",
        voice_settings: { stability: 0.5, similarity_boost: 0.5 }
      };
      const response = await axios.post(url, data, {
        headers, timeout: 20000, responseType: 'blob'
      });

      if (response.status === 200) {
        const audioBlob = new Blob([response.data], { type: 'audio/mpeg' });
        this.audioQueue.push(audioBlob);
        if (!this.isPlaying) {
          this.playNextInQueue();
        }
      } else {
        throw new Error(`Eleven Labs API error: ${response.status}`);
      }
    } catch (error) {
      console.error('Error with Eleven Labs API:', error);
      throw error;
    }
  }

  private async speakWithWebSpeech(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        return reject(new Error('Speech synthesis not supported'));
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => resolve();
      utterance.onerror = (event) => reject(event.error);
      speechSynthesis.speak(utterance);
    });
  }

  public async speakText(text: string): Promise<void> {
    if (!text || text.trim() === "") {
      return;
    }
    
    return new Promise(async (resolve, reject) => {
        this.currentPromise = { resolve, reject };
        if (this.elevenLabsApiKey) {
            try {
                await this.speakWithElevenLabs(text);
            } catch (error) {
                console.warn('Eleven Labs failed, falling back to Web Speech API.');
                try {
                    await this.speakWithWebSpeech(text);
                    resolve();
                } catch (webSpeechError) {
                    reject(webSpeechError);
                }
            }
        } else {
            try {
                await this.speakWithWebSpeech(text);
                resolve();
            } catch (webSpeechError) {
                reject(webSpeechError);
            }
        }
    });
  }
}