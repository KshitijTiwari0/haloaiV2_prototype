export class AudioProcessor {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private currentUtteranceChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private audioContext: AudioContext | null = null;
  private vadInterval: number | null = null;
  private isAITalking: boolean = false;
  private onUtteranceEndCallback: ((blob: Blob) => void) | null = null;
  private onSpeechStartCallback: (() => void) | null = null;
  private onSilenceCallback: (() => void) | null = null;

  // VAD State using standard parameters
  private vadState: 'SILENT' | 'VOICE' = 'SILENT';
  private silenceFrames: number = 0;
  private readonly requiredSilenceFrames = 15; // 1.5 seconds of silence
  private readonly vadThreshold = 0.01; // Standard RMS threshold

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

  async startRecording(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true } 
      });

      this.audioContext = new AudioContext({ sampleRate: 16000 });
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      source.connect(this.analyser);

      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: 'audio/webm;codecs=opus' });
      this.audioChunks = [];
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          if (this.onUtteranceEndCallback) {
            this.currentUtteranceChunks.push(event.data);
          }
        }
      };
      this.mediaRecorder.start(100);
      console.log('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }

  async startContinuousRecording(
    onUtteranceEnd: (blob: Blob) => void,
    onSpeechStart: () => void,
    onSilence: () => void
  ): Promise<void> {
    this.onUtteranceEndCallback = onUtteranceEnd;
    this.onSpeechStartCallback = onSpeechStart;
    this.onSilenceCallback = onSilence;
    await this.startRecording();
    this.startVAD();
  }

  private startVAD(): void {
    const dataArray = new Float32Array(this.analyser!.fftSize);
    this.vadInterval = window.setInterval(() => {
      if (!this.analyser || this.isAITalking) {
        return;
      }
      
      this.analyser.getFloatTimeDomainData(dataArray);
      
      // Calculate RMS - the standard way to measure audio energy
      let sumSquares = 0.0;
      for (const amplitude of dataArray) {
        sumSquares += amplitude * amplitude;
      }
      const rms = Math.sqrt(sumSquares / dataArray.length);
      const isSpeech = rms > this.vadThreshold;

      switch (this.vadState) {
        case 'SILENT':
          if (isSpeech) {
            this.vadState = 'VOICE';
            this.onSpeechStartCallback?.();
            console.log(`Speech detected (RMS: ${rms.toFixed(4)})`);
          }
          break;
        case 'VOICE':
          if (!isSpeech) {
            this.silenceFrames++;
            if (this.silenceFrames >= this.requiredSilenceFrames) {
              this.processUtteranceEnd();
            }
          } else {
            this.silenceFrames = 0;
          }
          break;
      }
    }, 100);
  }

  private processUtteranceEnd(): void {
    this.onSilenceCallback?.();
    this.vadState = 'SILENT';
    this.silenceFrames = 0;
    if (this.currentUtteranceChunks.length > 0) {
      console.log('Utterance ended, processing audio.');
      const utteranceBlob = new Blob(this.currentUtteranceChunks, { type: 'audio/webm' });
      this.currentUtteranceChunks = [];
      this.onUtteranceEndCallback?.(utteranceBlob);
    } else {
        console.log('Silence detected, but no audio chunks to process.');
    }
  }

  setAITalking(talking: boolean): void {
    this.isAITalking = talking;
  }

  stopContinuousRecording(): void {
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.cleanup();
  }

  private cleanup(): void {
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    this.audioContext = null;
    this.analyser = null;
    this.mediaRecorder = null;
  }

  async transcribeAudio(audioBlob: Blob, config: { assemblyai_api_key?: string }): Promise<string | null> {
    if (!config.assemblyai_api_key) {
        console.error('AssemblyAI API key not provided.');
        return null;
    }
    return await this.transcribeWithAssemblyAI(audioBlob, config.assemblyai_api_key);
  }

  async transcribeWithAssemblyAI(audioBlob: Blob, apiKey: string): Promise<string | null> {
    try {
      const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        headers: { 'authorization': apiKey },
        body: audioBlob
      });
      const uploadResult = await uploadResponse.json();
      const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: { 'authorization': apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({ audio_url: uploadResult.upload_url })
      });
      const transcriptResult = await transcriptResponse.json();
      while (true) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const statusResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptResult.id}`, {
          headers: { 'authorization': apiKey }
        });
        const statusResult = await statusResponse.json();
        if (statusResult.status === 'completed') return statusResult.text || null;
        if (statusResult.status === 'error') throw new Error(statusResult.error);
      }
    } catch (error) {
      console.error('AssemblyAI transcription error:', error);
      return null;
    }
  }
}