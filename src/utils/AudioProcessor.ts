export class AudioProcessor {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private currentUtteranceChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private audioContext: AudioContext | null = null;
  private vadInterval: number | null = null;
  private isSpeechDetectedInCurrentUtterance: boolean = false;
  private silenceCounter: number = 0;
  private isAITalking: boolean = false;
  private onUtteranceEndCallback: ((blob: Blob) => void) | null = null;
  private onSpeechStartCallback: (() => void) | null = null;
  private onSilenceCallback: (() => void) | null = null;

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
          // Also add to current utterance chunks for continuous recording
          if (this.onUtteranceEndCallback) {
            this.currentUtteranceChunks.push(event.data);
          }
        }
      };

      this.mediaRecorder.start(100); // Collect data every 100ms
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
    onSilence: () => void,
    silenceThreshold: number = 0.01
  ): Promise<void> {
    try {
      // Store callbacks
      this.onUtteranceEndCallback = onUtteranceEnd;
      this.onSpeechStartCallback = onSpeechStart;
      this.onSilenceCallback = onSilence;

      // Initialize recording
      await this.startRecording();

      // Start continuous VAD
      this.startVAD(silenceThreshold);

      console.log('Continuous recording started');
    } catch (error) {
      console.error('Recording error:', error);
      throw error;
    }
  }

  private startVAD(silenceThreshold: number): void {
    const maxSilenceChunks = 20; // ~2 seconds of silence at 100ms intervals

    this.vadInterval = window.setInterval(() => {
      if (!this.analyser) return;

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      this.analyser.getByteFrequencyData(dataArray);

      // Calculate RMS (Root Mean Square) for volume detection
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / bufferLength) / 255;

      const isSpeechDetected = rms > silenceThreshold;

      // Don't process user speech while AI is talking
      if (this.isAITalking) {
        // Clear any accumulated chunks while AI is talking
        if (this.currentUtteranceChunks.length > 0) {
          this.currentUtteranceChunks = [];
          this.isSpeechDetectedInCurrentUtterance = false;
          this.silenceCounter = 0;
        }
        return;
      }

      if (isSpeechDetected) {
        // Speech detected
        if (!this.isSpeechDetectedInCurrentUtterance) {
          // Start of new utterance
          this.isSpeechDetectedInCurrentUtterance = true;
          this.onSpeechStartCallback?.();
          console.log('Speech started');
        }
        this.silenceCounter = 0;
      } else {
        // Silence detected
        if (this.isSpeechDetectedInCurrentUtterance) {
          this.silenceCounter++;
          this.onSilenceCallback?.();

          // End of utterance after sufficient silence
          if (this.silenceCounter >= maxSilenceChunks) {
            this.processUtteranceEnd();
          }
        }
      }
    }, 100); // Check every 100ms
  }

  private processUtteranceEnd(): void {
    if (this.currentUtteranceChunks.length > 0) {
      const utteranceBlob = new Blob(this.currentUtteranceChunks, { type: 'audio/webm' });
      console.log('Utterance ended, processing audio blob');
      
      // Reset for next utterance
      this.currentUtteranceChunks = [];
      this.isSpeechDetectedInCurrentUtterance = false;
      this.silenceCounter = 0;

      // Process the utterance
      this.onUtteranceEndCallback?.(utteranceBlob);
    }
  }

  setAITalking(talking: boolean): void {
    this.isAITalking = talking;
    console.log(`AI talking state: ${talking}`);
  }

  stopContinuousRecording(): void {
    console.log('Stopping continuous recording');
    
    // Clear VAD interval
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }

    // Stop media recorder
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    // Clear callbacks and state
    this.onUtteranceEndCallback = null;
    this.onSpeechStartCallback = null;
    this.onSilenceCallback = null;
    this.currentUtteranceChunks = [];
    this.isSpeechDetectedInCurrentUtterance = false;
    this.silenceCounter = 0;
    this.isAITalking = false;

    // Cleanup audio resources
    this.cleanup();
  }

  async recordWithVAD(maxDuration: number = 10, silenceThreshold: number = 0.01): Promise<Blob | null> {
    try {
      await this.startRecording();
      
      return new Promise((resolve, reject) => {
        let silenceCounter = 0;
        const maxSilenceChunks = 20; // ~2 seconds of silence
        let hasSpokenContent = false;

        const checkSilence = () => {
          if (!this.analyser) return;

          const bufferLength = this.analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          this.analyser.getByteFrequencyData(dataArray);

          // Calculate RMS (Root Mean Square) for volume detection
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i] * dataArray[i];
          }
          const rms = Math.sqrt(sum / bufferLength) / 255;

          if (rms > silenceThreshold) {
            silenceCounter = 0;
            hasSpokenContent = true;
          } else {
            silenceCounter++;
          }

          // Stop if we've detected speech and then silence
          if (hasSpokenContent && silenceCounter >= maxSilenceChunks) {
            this.stopRecording().then(resolve).catch(reject);
            return;
          }

          setTimeout(checkSilence, 100);
        };

        // Start silence detection
        setTimeout(checkSilence, 100);

        // Maximum duration timeout
        setTimeout(() => {
          this.stopRecording().then(resolve).catch(reject);
        }, maxDuration * 1000);
      });
    } catch (error) {
      console.error('Recording error:', error);
      return null;
    }
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

  // Web Speech API (Free, built into browsers)
  async transcribeWithWebSpeech(audioBlob: Blob): Promise<string | null> {
    return new Promise((resolve) => {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.warn('Web Speech API not supported');
        resolve(null);
        return;
      }

      try {
        // Create audio element to play the recorded audio
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        // Use Web Speech API with live microphone (limitation: can't process recorded audio directly)
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          URL.revokeObjectURL(audioUrl);
          resolve(transcript);
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          URL.revokeObjectURL(audioUrl);
          resolve(null);
        };

        recognition.onend = () => {
          URL.revokeObjectURL(audioUrl);
        };

        // Note: Web Speech API works with live audio, not recorded blobs
        // This is a limitation we'll work around
        console.warn('Web Speech API limitation: Cannot process recorded audio directly');
        resolve(null);
      } catch (error) {
        console.error('Web Speech API error:', error);
        resolve(null);
      }
    });
  }

  // Hugging Face Inference API (Free with rate limits)
  async transcribeWithHuggingFace(audioBlob: Blob): Promise<string | null> {
    try {
      console.log('Attempting Hugging Face transcription...');
      
      const response = await fetch('https://api-inference.huggingface.co/models/openai/whisper-tiny', {
        method: 'POST',
        headers: {
          'Content-Type': 'audio/wav',
        },
        body: audioBlob
      });

      if (!response.ok) {
        throw new Error(`Hugging Face API error: ${response.statusText}`);
      }

      const result = await response.json();
      return result.text || null;
    } catch (error) {
      console.error('Hugging Face transcription error:', error);
      return null;
    }
  }

  // AssemblyAI (Free tier available)
  async transcribeWithAssemblyAI(audioBlob: Blob, apiKey?: string): Promise<string | null> {
    if (!apiKey) {
      console.warn('AssemblyAI API key not provided');
      return null;
    }

    try {
      console.log('Attempting AssemblyAI transcription...');
      
      // First, upload the audio file
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

      // Then, request transcription
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

      // Poll for completion
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds timeout
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        
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

  // OpenAI Whisper API (Paid but most reliable)
  async transcribeWithOpenAI(audioBlob: Blob, apiKey: string): Promise<string | null> {
    try {
      console.log('Attempting OpenAI Whisper transcription...');
      
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');
      formData.append('model', 'whisper-1');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`OpenAI transcription failed: ${response.statusText}`);
      }

      const result = await response.json();
      return result.text || null;
    } catch (error) {
      console.error('OpenAI transcription error:', error);
      return null;
    }
  }

  // Main transcription method with fallbacks
  async transcribeAudio(audioBlob: Blob, config: { 
    openai_api_key?: string, 
    assemblyai_api_key?: string,
    transcription_method?: string 
  } = {}): Promise<string | null> {
    if (!audioBlob || audioBlob.size === 0) {
      console.warn('No audio data to transcribe');
      return null;
    }

    const method = config.transcription_method || 'auto';
    
    console.log(`Transcribing audio using method: ${method}`);

    // Try methods in order of preference
    const methods = [
      {
        name: 'huggingface',
        fn: () => this.transcribeWithHuggingFace(audioBlob)
      },
      {
        name: 'assemblyai',
        fn: () => this.transcribeWithAssemblyAI(audioBlob, config.assemblyai_api_key)
      },
      {
        name: 'openai',
        fn: () => config.openai_api_key ? this.transcribeWithOpenAI(audioBlob, config.openai_api_key) : null
      }
    ];

    if (method !== 'auto') {
      // Try specific method first
      const specificMethod = methods.find(m => m.name === method);
      if (specificMethod) {
        const result = await specificMethod.fn();
        if (result) return result;
      }
    }

    // Try all methods as fallbacks
    for (const methodObj of methods) {
      try {
        console.log(`Trying ${methodObj.name} transcription...`);
        const result = await methodObj.fn();
        if (result && result.trim()) {
          console.log(`Successfully transcribed with ${methodObj.name}`);
          return result.trim();
        }
      } catch (error) {
        console.warn(`${methodObj.name} transcription failed:`, error);
      }
    }

    console.error('All transcription methods failed');
    return null;
  }
}