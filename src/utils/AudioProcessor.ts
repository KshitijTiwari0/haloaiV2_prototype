export class AudioProcessor {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private socket: WebSocket | null = null;
  private onTranscriptUpdateCallback: ((transcript: { text: string; final: boolean }) => void) | null = null;
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

  async startContinuousStreaming(
    onTranscriptUpdate: (transcript: { text: string; final: boolean }) => void,
    onSpeechStart: () => void
  ): Promise<void> {
    this.onTranscriptUpdateCallback = onTranscriptUpdate;
    this.onSpeechStartCallback = onSpeechStart;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true }
      });

      this.onSpeechStartCallback?.();

      const tokenResponse = await fetch('/api/get-assemblyai-token', {
        method: 'POST',
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json().catch(() => ({ error: "Failed to parse error response." }));
        throw new Error(errorData.error || `Token request failed with status: ${tokenResponse.status}`);
      }
      
      const { token } = await tokenResponse.json();

      if (!token) {
        throw new Error('Could not fetch AssemblyAI token: No token received');
      }

      this.socket = new WebSocket(`wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${token}`);
      
      this.socket.onmessage = (message) => {
        const res = JSON.parse(message.data);
        if (res.message_type === 'FinalTranscript' && res.text) {
          this.onTranscriptUpdateCallback?.({ text: res.text, final: true });
        }
      };

      this.socket.onerror = (event) => console.error('WebSocket Error:', event);
      
      this.socket.onclose = (event) => {
        console.log('WebSocket Closed:', event.code, event.reason);
        this.socket = null;
      };

      this.socket.onopen = () => {
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
  
  private floatTo16BitPCM(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
  }
  
  stopContinuousStreaming(): void {
    if (this.socket) {
      this.socket.close(1000, "Call ended by user");
    }
    this.cleanup();
  }

  private cleanup(): void {
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.audioContext = null;
  }
}