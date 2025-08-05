import axios from 'axios';

export class TextToSpeechEngine {
  private elevenLabsApiKey?: string;
  private voiceId: string;
  private maxChars: number = 5000;
  private lastApiCall: number = 0;
  private minDelay: number = 1000;

  constructor(elevenLabsApiKey?: string, voiceId: string = "21m00Tcm4TlvDq8ikWAM") {
    this.elevenLabsApiKey = elevenLabsApiKey;
    this.voiceId = voiceId;
    console.log(`TextToSpeechEngine initialized with voice_id: ${voiceId}, API key provided: ${!!elevenLabsApiKey}`);
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
  }
}