import axios from 'axios';

export class TextToSpeechEngine {
  private elevenLabsApiKey?: string;
  private voiceId: string;
  private audio: HTMLAudioElement; // Reusable audio element
  private isPlaying: boolean = false;
  private audioQueue: Blob[] = [];

  constructor(elevenLabsApiKey?: string, voiceId: string = "21m00Tcm4TlvDq8ikWAM") {
    this.elevenLabsApiKey = elevenLabsApiKey;
    this.voiceId = voiceId;
    this.audio = new Audio();
    this.audio.onended = () => {
      this.isPlaying = false;
      this.playNextInQueue();
    };
    console.log(`TextToSpeechEngine initialized with voice_id: ${voiceId}, API key provided: ${!!elevenLabsApiKey}`);
  }

  private async speakWithElevenLabs(text: string): Promise<boolean> {
    try {
      console.log(`Attempting to use Eleven Labs API with voice_id: ${this.voiceId} for text: ${text.substring(0, 50)}...`);
      
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

      if (response.status === 200) {
        const audioBlob = new Blob([response.data], { type: 'audio/mpeg' });
        this.audioQueue.push(audioBlob);
        if (!this.isPlaying) {
          this.playNextInQueue();
        }
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

  private playNextInQueue() {
    if (this.audioQueue.length > 0) {
      this.isPlaying = true;
      const audioBlob = this.audioQueue.shift();
      const audioUrl = URL.createObjectURL(audioBlob!);
      this.audio.src = audioUrl;
      this.audio.play();
    }
  }

  private async speakWithWebSpeech(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        reject(new Error('Speech synthesis not supported'));
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;

      utterance.onend = () => resolve();
      utterance.onerror = (event) => reject(event.error);

      speechSynthesis.speak(utterance);
      console.log(`Speaking with Web Speech API: ${text}`);
    });
  }

  async speakText(text: string): Promise<void> {
    if (!text || text.trim() === "") {
      console.warn('No valid text provided for TTS');
      throw new Error('No text to speak');
    }

    console.log(`Processing text for TTS: ${text}`);

    if (this.elevenLabsApiKey) {
      if (!(await this.speakWithElevenLabs(text))) {
        console.warn('Falling back to Web Speech API due to Eleven Labs failure');
        await this.speakWithWebSpeech(text);
      }
    } else {
      console.warn('No Eleven Labs API key provided, using Web Speech API');
      await this.speakWithWebSpeech(text);
    }
  }
}