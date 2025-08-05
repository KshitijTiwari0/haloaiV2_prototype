export class AudioProcessor {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private audioContext: AudioContext | null = null;
  private vadInterval: number | null = null;
  private isAITalking: boolean = false;
  private onUtteranceEndCallback: ((blob: Blob) => void) | null = null;
  private onSpeechStartCallback: (() => void) | null = null;
  private onSilenceCallback: (() => void) | null = null;

  private vadState: 'SILENT' | 'VOICE' = 'SILENT';
  private silenceFrames: number = 0;
  private readonly requiredSilenceFrames = 15; // ~1.5 seconds of silence
  private readonly vadThreshold = 0.01;

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

  // This method now only sets up the stream and VAD, but doesn't start recording.
  async startContinuousRecording(
    onUtteranceEnd: (blob: Blob) => void,
    onSpeechStart: () => void,
    onSilence: () => void
  ): Promise<void> {
    this.onUtteranceEndCallback = onUtteranceEnd;
    this.onSpeechStartCallback = onSpeechStart;
    this.onSilenceCallback = onSilence;
    
    if (!this.stream) {
        this.stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true } 
        });
        this.audioContext = new AudioContext({ sampleRate: 16000 });
        const source = this.audioContext.createMediaStreamSource(this.stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        source.connect(this.analyser);
    }

    this.startVAD();
  }

  private startVAD(): void {
    const dataArray = new Float32Array(this.analyser!.fftSize);
    this.vadInterval = window.setInterval(() => {
      if (!this.analyser || this.isAITalking) {
        return;
      }
      
      this.analyser.getFloatTimeDomainData(dataArray);
      
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
            // **NEW LOGIC**: Start recording only when speech is detected.
            this.startRecordingForUtterance();
          }
          break;
        case 'VOICE':
          if (!isSpeech) {
            this.silenceFrames++;
            if (this.silenceFrames >= this.requiredSilenceFrames) {
              this.vadState = 'SILENT';
              this.onSilenceCallback?.();
              // **NEW LOGIC**: Stop recording when silence is detected.
              this.stopRecordingForUtterance();
            }
          } else {
            this.silenceFrames = 0;
          }
          break;
      }
    }, 100);
  }

  // **NEW METHOD**: A dedicated function to start a clean recording for a single utterance.
  private startRecordingForUtterance(): void {
    if (this.stream) {
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: 'audio/webm;codecs=opus' });
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        if (this.audioChunks.length > 0) {
          const utteranceBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          this.onUtteranceEndCallback?.(utteranceBlob);
          this.audioChunks = [];
        }
      };

      this.mediaRecorder.start();
      console.log('Recording started for new utterance.');
    }
  }

  // **NEW METHOD**: A dedicated function to stop the recording and trigger the callback.
  private stopRecordingForUtterance(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
      console.log('Recording stopped for utterance.');
    }
    this.silenceFrames = 0;
  }

  setAITalking(talking: boolean): void {
    this.isAITalking = talking;
  }

  stopContinuousRecording(): void {
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }
    this.stopRecordingForUtterance();
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
      console.log('AssemblyAI: Uploading audio blob - type:', audioBlob.type, 'size:', audioBlob.size);
      
      const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        headers: { 
          'authorization': apiKey,
          'Content-Type': audioBlob.type || 'audio/webm'
        },
        body: audioBlob
      });
      
      if (!uploadResponse.ok) {
        const errorBody = await uploadResponse.text();
        throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText} - ${errorBody}`);
      }
      
      const uploadResult = await uploadResponse.json();
      if (!uploadResult.upload_url) {
        throw new Error('AssemblyAI upload did not return a URL.');
      }
      console.log('AssemblyAI: Upload successful, audio_url:', uploadResult.upload_url);
      
      const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: { 'authorization': apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({ audio_url: uploadResult.upload_url })
      });
      
      if (!transcriptResponse.ok) {
        throw new Error(`Transcript request failed: ${transcriptResponse.status} ${transcriptResponse.statusText}`);
      }
      
      const transcriptResult = await transcriptResponse.json();
      console.log('AssemblyAI: Transcript request submitted, id:', transcriptResult.id);
      
      while (true) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const statusResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptResult.id}`, {
          headers: { 'authorization': apiKey }
        });
        const statusResult = await statusResponse.json();
        
        console.log('AssemblyAI: Transcript status:', statusResult.status);
        
        if (statusResult.status === 'completed') {
          console.log('AssemblyAI: Transcription completed:', statusResult.text);
          return statusResult.text || null;
        }
        if (statusResult.status === 'error') {
          console.error('AssemblyAI: Transcription error:', statusResult.error);
          throw new Error(statusResult.error);
        }
      }
    } catch (error) {
      console.error('AssemblyAI transcription error:', error);
      return null;
    }
  }
}