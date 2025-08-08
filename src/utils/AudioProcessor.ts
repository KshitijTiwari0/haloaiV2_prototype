export class AudioProcessor {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isRecording: boolean = false;
  private isPaused: boolean = false;
  private stream: MediaStream | null = null;
  private onTranscriptUpdateCallback: ((transcript: { text: string; final: boolean }) => void) | null = null;
  private onSpeechStartCallback: (() => void) | null = null;
  private recordingTimeout: number | null = null;
  private silenceTimeout: number | null = null;
  private isProcessing: boolean = false;

  // Configuration
  private readonly MAX_RECORDING_TIME = 30000; // 30 seconds
  private readonly SILENCE_TIMEOUT = 3000; // 3 seconds of silence
  private readonly MIN_RECORDING_TIME = 1000; // 1 second minimum

  constructor() {
    console.log('AudioProcessor initialized for OpenAI Whisper');
  }

  async startContinuousStreaming(
    onTranscriptUpdate: (transcript: { text: string; final: boolean }) => void,
    onSpeechStart: () => void
  ): Promise<void> {
    this.onTranscriptUpdateCallback = onTranscriptUpdate;
    this.onSpeechStartCallback = onSpeechStart;

    try {
      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000, // Optimal for Whisper
        }
      });

      this.isPaused = false;
      this.isProcessing = false;
      
      await this.startRecording();
      console.log('Started continuous audio streaming for Whisper');
    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw new Error('Failed to access microphone. Please check permissions.');
    }
  }

  private async startRecording(): Promise<void> {
    if (!this.stream || this.isPaused || this.isProcessing) return;

    try {
      // Clear any existing chunks
      this.audioChunks = [];

      // Create MediaRecorder with optimal settings for Whisper
      const options: MediaRecorderOptions = {
        mimeType: 'audio/webm;codecs=opus', // Fallback to supported format
      };

      // Try different formats in order of preference
      const supportedFormats = [
        'audio/webm;codecs=opus',
        'audio/mp4;codecs=mp4a.40.2',
        'audio/webm',
        'audio/mp4'
      ];

      for (const format of supportedFormats) {
        if (MediaRecorder.isTypeSupported(format)) {
          options.mimeType = format;
          break;
        }
      }

      this.mediaRecorder = new MediaRecorder(this.stream, options);
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        await this.processRecording();
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
      };

      // Start recording
      this.mediaRecorder.start(250); // Collect data every 250ms
      this.isRecording = true;
      this.onSpeechStartCallback?.();

      // Set maximum recording time
      this.recordingTimeout = setTimeout(() => {
        this.stopCurrentRecording();
      }, this.MAX_RECORDING_TIME) as unknown as number;

      // Set silence detection timeout
      this.resetSilenceTimeout();

      console.log('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }

  private resetSilenceTimeout(): void {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
    }

    this.silenceTimeout = setTimeout(() => {
      console.log('Silence detected, stopping recording');
      this.stopCurrentRecording();
    }, this.SILENCE_TIMEOUT) as unknown as number;
  }

  private stopCurrentRecording(): void {
    if (!this.mediaRecorder || !this.isRecording) return;

    try {
      this.mediaRecorder.stop();
      this.isRecording = false;

      // Clear timeouts
      if (this.recordingTimeout) {
        clearTimeout(this.recordingTimeout);
        this.recordingTimeout = null;
      }
      if (this.silenceTimeout) {
        clearTimeout(this.silenceTimeout);
        this.silenceTimeout = null;
      }

      console.log('Recording stopped');
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  }

  private async processRecording(): Promise<void> {
    if (this.audioChunks.length === 0 || this.isProcessing) return;

    this.isProcessing = true;

    try {
      // Create audio blob
      const audioBlob = new Blob(this.audioChunks, { 
        type: this.mediaRecorder?.mimeType || 'audio/webm' 
      });

      // Check minimum duration (approximate)
      if (audioBlob.size < 1000) { // Very small file, likely no speech
        console.log('Recording too short, skipping transcription');
        this.startNextRecording();
        return;
      }

      console.log('Processing audio blob:', {
        size: audioBlob.size,
        type: audioBlob.type,
        chunks: this.audioChunks.length
      });

      // Send to transcription
      const transcript = await this.transcribeWithWhisper(audioBlob);
      
      if (transcript && transcript.trim()) {
        console.log('Whisper transcript:', transcript);
        this.onTranscriptUpdateCallback?.({
          text: transcript.trim(),
          final: true
        });
      } else {
        console.log('No speech detected in audio');
        this.startNextRecording();
      }

    } catch (error) {
      console.error('Error processing recording:', error);
      this.startNextRecording();
    }
  }

  private async transcribeWithWhisper(audioBlob: Blob): Promise<string> {
    try {
      // Convert to the format expected by Whisper API
      const audioFile = new File([audioBlob], 'audio.webm', {
        type: audioBlob.type
      });

      // Call Netlify function for Whisper transcription
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('model', 'whisper-1');
      formData.append('language', 'en');

      const response = await fetch('/.netlify/functions/transcribe-audio', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Whisper API error:', response.status, errorText);
        throw new Error(`Transcription failed: ${response.status}`);
      }

      const result = await response.json();
      return result.text || '';

    } catch (error) {
      console.error('Whisper transcription error:', error);
      throw error;
    }
  }

  private startNextRecording(): void {
    this.isProcessing = false;
    
    // Start next recording if not paused
    if (!this.isPaused && this.stream) {
      setTimeout(() => {
        this.startRecording();
      }, 500);
    }
  }

  pauseRecording(): void {
    console.log('Pausing recording...');
    this.isPaused = true;
    
    if (this.isRecording) {
      this.stopCurrentRecording();
    }
  }

  resumeRecording(): void {
    console.log('Resuming recording...');
    this.isPaused = false;
    this.isProcessing = false;
    
    if (this.stream) {
      setTimeout(() => {
        this.startRecording();
      }, 1000);
    }
  }

  stopContinuousStreaming(): void {
    console.log('Stopping continuous streaming...');
    
    this.isPaused = false;
    this.isProcessing = false;
    
    // Stop current recording
    if (this.isRecording) {
      this.stopCurrentRecording();
    }

    // Clear timeouts
    if (this.recordingTimeout) {
      clearTimeout(this.recordingTimeout);
      this.recordingTimeout = null;
    }
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }

    // Stop media stream
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    // Clear MediaRecorder
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
  }

  // Method for mobile to manually restart recognition (compatibility)
  restartRecording(): void {
    if (!this.isPaused && !this.isProcessing && this.stream) {
      this.startRecording();
    }
  }
}