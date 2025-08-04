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

  private vadState: 'SILENT' | 'VOICE' = 'SILENT';
  private silenceFrames: number = 0;
  private readonly requiredSilenceFrames = 15;
  private readonly vadThreshold = 0.02;

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
      
      console.log(`Found ${audioInputs.length} audio input device(s)`);
      return true;
    } catch (error) {
      console.error('Microphone setup error:', error);
      return false;
    }
  }

  async startRecording(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });

      this.audioContext = new AudioContext({ sampleRate: 16000 });
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      source.connect(this.analyser);

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

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

  async stopRecording(): Promise<Blob | null> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No active recording'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        try {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          this.cleanup();
          resolve(audioBlob);
        } catch (error) {
          reject(error);
        }
      };

      this.mediaRecorder.stop();
    });
  }

  async startContinuousRecording(
    onUtteranceEnd: (blob: Blob) => void,
    onSpeechStart: () => void,
    onSilence: () => void
  ): Promise<void> {
    try {
      this.onUtteranceEndCallback = onUtteranceEnd;
      this.onSpeechStartCallback = onSpeechStart;
      this.onSilenceCallback = onSilence;

      await this.startRecording();
      this.startVAD();

      console.log('Continuous recording started');
    } catch (error) {
      console.error('Recording error:', error);
      throw error;
    }
  }

  private startVAD(): void {
    this.vadInterval = window.setInterval(() => {
      if (!this.analyser || this.isAITalking) {
        return;
      }

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      this.analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      const isSpeech = average > (this.vadThreshold * 255);

      switch (this.vadState) {
        case 'SILENT':
          if (isSpeech) {
            this.vadState = 'VOICE';
            this.onSpeechStartCallback?.();
            console.log('Speech detected');
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
      const utteranceBlob = new Blob(this.currentUtteranceChunks, { type: 'audio/webm' });
      console.log('Utterance ended, processing audio blob');
      
      this.currentUtteranceChunks = [];
      this.onUtteranceEndCallback?.(utteranceBlob);
    }
  }

  setAITalking(talking: boolean): void {
    this.isAITalking = talking;
    console.log(`AI talking state: ${talking}`);
  }

  stopContinuousRecording(): void {
    console.log('Stopping continuous recording');
    
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    this.onUtteranceEndCallback = null;
    this.onSpeechStartCallback = null;
    this.onSilenceCallback = null;
    this.currentUtteranceChunks = [];
    this.isAITalking = false;

    this.cleanup();
  }

  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
    this.mediaRecorder = null;
  }

  async transcribeAudio(audioBlob: Blob, config: { 
    openai_api_key?: string, 
    assemblyai_api_key?: string,
    transcription_method?: string 
  } = {}): Promise<string | null> {
    if (!audioBlob || audioBlob.size === 0) {
      console.warn('No audio data to transcribe');
      return null;
    }

    console.log("Forcing AssemblyAI for transcription.");
    
    if (config.assemblyai_api_key) {
      const result = await this.transcribeWithAssemblyAI(audioBlob, config.assemblyai_api_key);
      if (result) {
        return result;
      }
    }
    
    console.error('AssemblyAI transcription failed or API key not provided.');
    return null;
  }

  async transcribeWithAssemblyAI(audioBlob: Blob, apiKey?: string): Promise<string | null> {
    if (!apiKey) {
      console.warn('AssemblyAI API key not provided');
      return null;
    }

    try {
      console.log('Attempting AssemblyAI transcription...');
      
      const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        headers: {
          'authorization': apiKey,
          'content-type': 'application/octet-stream'
        },
        body: audioBlob
      });

      if (!uploadResponse.ok) {
        throw new Error(`AssemblyAI upload error: ${uploadResponse.statusText}`);
      }

      const uploadResult = await uploadResponse.json();
      const audioUrl = uploadResult.upload_url;

      const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: {
          'authorization': apiKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          audio_url: audioUrl,
          language_code: 'en'
        })
      });

      if (!transcriptResponse.ok) {
        throw new Error(`AssemblyAI transcription error: ${transcriptResponse.statusText}`);
      }

      const transcriptResult = await transcriptResponse.json();
      const transcriptId = transcriptResult.id;

      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
          headers: {
            'authorization': apiKey
          }
        });

        if (!statusResponse.ok) {
          throw new Error(`AssemblyAI status error: ${statusResponse.statusText}`);
        }

        const statusResult = await statusResponse.json();
        
        if (statusResult.status === 'completed') {
          return statusResult.text || null;
        } else if (statusResult.status === 'error') {
          throw new Error(`AssemblyAI processing error: ${statusResult.error}`);
        }
        
        attempts++;
      }

      throw new Error('AssemblyAI transcription timeout');
    } catch (error) {
      console.error('AssemblyAI transcription error:', error);
      return null;
    }
  }
}