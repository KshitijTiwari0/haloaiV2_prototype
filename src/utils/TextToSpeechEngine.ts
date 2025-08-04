import axios from 'axios';

export class TextToSpeechEngine {
  private elevenLabsApiKey?: string;
  private voiceId: string;
  private audioQueue: { blob: Blob, resolve: () => void, reject: (reason?: any) => void }[] = [];
  private isPlaying: boolean = false;
  private audio: HTMLAudioElement;

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
        if(this.audioQueue.length > 0) {
            this.audioQueue[0].reject(e);
        }
    }
  }

  private playNextInQueue() {
    if (this.audioQueue.length > 0) {
      this.isPlaying = true;
      const { blob, resolve } = this.audioQueue[0];
      const audioUrl = URL.createObjectURL(blob);
      this.audio.src = audioUrl;
      this.audio.play();
      this.audio.onended = () => {
          this.isPlaying = false;
          URL.revokeObjectURL(audioUrl);
          this.audioQueue.shift(); // Remove the played item
          resolve(); // Resolve the promise for the completed audio
          this.playNextInQueue();
      };
    }
  }

  private async speakWithElevenLabs(text: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
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
            this.audioQueue.push({ blob: audioBlob, resolve, reject });
            if (!this.isPlaying) {
              this.playNextInQueue();
            }
          } else {
            reject(new Error(`Eleven Labs API error: ${response.status}`));
          }
        } catch (error) {
          console.error('Error with Eleven Labs API:', error);
          reject(error);
        }
    });
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
    
    if (this.elevenLabsApiKey) {
        try {
            await this.speakWithElevenLabs(text);
        } catch (error) {
            console.warn('Eleven Labs failed, falling back to Web Speech API.');
            await this.speakWithWebSpeech(text);
        }
    } else {
        await this.speakWithWebSpeech(text);
    }
  }
}