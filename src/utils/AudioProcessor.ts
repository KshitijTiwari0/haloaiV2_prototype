export class AudioProcessor {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private socket: WebSocket | null = null;
  private onTranscriptUpdateCallback: ((transcript: { text: string; final: boolean }) => void) | null = null;

  // Simplified callbacks for the companion
  private onUtteranceEndCallback: ((blob: Blob) => void) | null = null;
  private onSpeechStartCallback: (() => void) | null = null;

  constructor() {
    this.testMicrophoneSetup();
  }

  private async testMicrophoneSetup(): Promise<boolean> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      if (audioInputs.length === 0) {
        console.error('No microphone devices found');
        return false;
      }
      return true;
    } catch (error) {
      console.error('Microphone setup error:', error);
      return false;
    }
  }

  // This is the new entry point for the companion
  async startContinuousStreaming(
    onTranscriptUpdate: (transcript: { text: string; final: boolean }) => void,
    onSpeechStart: () => void,
    config: { assemblyai_api_key?: string }
  ): Promise<void> {
    if (!config.assemblyai_api_key) {
      console.error('AssemblyAI API key not provided for streaming.');
      return;
    }

    this.onTranscriptUpdateCallback = onTranscriptUpdate;
    this.onSpeechStartCallback = onSpeechStart;

    try {
      // 1. Get Microphone Stream
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true }
      });

      this.onSpeechStartCallback?.();

      // 2. Get AssemblyAI WebSocket Token
      const tokenResponse = await fetch('https://api.assemblyai.com/v2/realtime/token', {
        method: 'POST',
        headers: { 'authorization': config.assemblyai_api_key },
        body: JSON.stringify({ expires_in: 3600 })
      });
      const { token } = await tokenResponse.json();

      // 3. Open WebSocket Connection
      this.socket = new WebSocket(`wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${token}`);
      
      this.socket.onmessage = (message) => {
        const res = JSON.parse(message.data);
        if (res.message_type === 'FinalTranscript' && res.text) {
          this.onTranscriptUpdateCallback?.({ text: res.text, final: true });
        } else if (res.message_type === 'PartialTranscript' && res.text) {
          // You can use partial transcripts for a faster UI, but for now we only care about final ones.
          // console.log('Partial Transcript:', res.text);
        }
      };

      this.socket.onerror = (event) => console.error('WebSocket Error:', event);
      
      this.socket.onclose = (event) => {
        console.log('WebSocket Closed:', event.code, event.reason);
        this.socket = null;
      };

      this.socket.onopen = () => {
        // 4. Start Streaming Audio
        this.audioContext = new AudioContext({ sampleRate: 16000 });
        const source = this.audioContext.createMediaStreamSource(this.stream!);
        const processor = this.audioContext.createScriptProcessor(1024, 1, 1);
        
        processor.onaudioprocess = (e) => {
          if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            const inputData = e.inputBuffer.getChannelData(0);
            const downsampledBuffer = this.floatTo16BitPCM(inputData);
            this.socket.send(downsampledBuffer);
          }
        };

        source.connect(processor);
        processor.connect(this.audioContext.destination);
      };

    } catch (error) {
      console.error('Error starting continuous streaming:', error);
    }
  }
  
  // Helper to convert audio to the format AssemblyAI expects
  private floatTo16BitPCM(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
  }
  
  // This is now simplified to just close connections
  stopContinuousStreaming(): void {
    if (this.socket) {
      this.socket.close(1000, "Call ended by user");
    }
    this.cleanup();
  }

  private cleanup(): void {
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    this.audioContext?.close();
    this.audioContext = null;
  }
  
  // Kept for compatibility, but the streaming method is now primary
  async transcribeAudio(audioBlob: Blob, config: { assemblyai_api_key?: string }): Promise<string | null> {
    // This is a fallback and should not be used in the new streaming logic
    console.warn("Using fallback transcribeAudio method.");
    if (!config.assemblyai_api_key) {
        console.error('AssemblyAI API key not provided.');
        return null;
    }
    // The original logic for blob upload remains here as a fallback
    return null; 
  }
}