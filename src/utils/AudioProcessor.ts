import { SupportedLanguage } from '../types';

export class AudioProcessor {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isRecording: boolean = false;
  private isPaused: boolean = false;
  private stream: MediaStream | null = null;
  private onTranscriptUpdateCallback: ((transcript: { text: string; final: boolean; language?: string }) => void) | null = null;
  private onSpeechStartCallback: (() => void) | null = null;
  private recordingTimeout: number | null = null;
  private silenceTimeout: number | null = null;
  private isProcessing: boolean = false;
  private currentLanguage: SupportedLanguage = 'auto';

  private readonly MAX_RECORDING_TIME = 30000; // 30 seconds
  private readonly SILENCE_TIMEOUT = 3000; // 3 seconds of silence
  private readonly MIN_RECORDING_TIME = 1000; // 1 second minimum

  constructor() {
    console.log('AudioProcessor initialized for OpenAI Whisper with multi-language support');
  }

  setLanguage(language: SupportedLanguage): void {
    this.currentLanguage = language;
    console.log(`AudioProcessor language set to: ${language}`);
  }

  getCurrentLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }

  async startContinuousStreaming(
    onTranscriptUpdate: (transcript: { text: string; final: boolean; language?: string }) => void,
    onSpeechStart: () => void,
    language: SupportedLanguage = 'auto'
  ): Promise<void> {
    this.onTranscriptUpdateCallback = onTranscriptUpdate;
    this.onSpeechStartCallback = onSpeechStart;
    this.currentLanguage = language;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        }
      });

      this.isPaused = false;
      this.isProcessing = false;
      
      await this.startRecording();
      console.log(`Started continuous audio streaming for Whisper (language: ${language})`);
    } catch (error: any) {
      console.error('Error accessing microphone:', error);
      if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
        throw new Error('Microphone permission was denied. Please allow microphone access in your browser settings.');
      }
      throw new Error('Failed to access microphone. Please check permissions and ensure your connection is secure (HTTPS).');
    }
  }

  private async startRecording(): Promise<void> {
    if (!this.stream || this.isPaused || this.isProcessing) return;

    try {
      this.audioChunks = [];

      // Safari/iOS is very specific about supported MIME types.
      const isAppleDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      const supportedFormats = [
        // Prioritize iOS-friendly formats first if on an Apple device
        ...(isAppleDevice ? ['audio/mp4', 'audio/aac'] : []), 
        'audio/webm;codecs=opus',
        'audio/ogg;codecs=opus',
        // Fallback
        'audio/webm',
      ];

      let selectedFormat: string | undefined = supportedFormats.find(format => MediaRecorder.isTypeSupported(format));

      if (!selectedFormat) {
          console.warn("No preferred MIME type supported. Falling back to default.");
          selectedFormat = 'audio/webm'; // Let it try the default if none are explicitly supported
      }
      
      console.log(`Using MIME type: ${selectedFormat}`);

      const options: MediaRecorderOptions = { mimeType: selectedFormat };
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
        // Attempt to recover by restarting the recording process
        this.startNextRecording();
      };

      this.mediaRecorder.start(250); // Collect chunks every 250ms
      this.isRecording = true;
      this.onSpeechStartCallback?.();

      this.recordingTimeout = setTimeout(() => {
        this.stopCurrentRecording();
      }, this.MAX_RECORDING_TIME) as unknown as number;

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
      if (Date.now() - (this.mediaRecorder?.start || 0) > this.MIN_RECORDING_TIME) {
        console.log('Silence detected, stopping recording');
        this.stopCurrentRecording();
      }
    }, this.SILENCE_TIMEOUT) as unknown as number;
  }
  
  private stopCurrentRecording(): void {
    if (!this.mediaRecorder || !this.isRecording) return;
  
    try {
      this.mediaRecorder.stop();
      this.isRecording = false;
  
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
      if (error instanceof DOMException && error.name === 'InvalidStateError') {
        console.warn('Tried to stop an already stopped recorder.');
      } else {
        console.error('Error stopping recording:', error);
      }
    }
  }

  private async processRecording(): Promise<void> {
    if (this.audioChunks.length === 0 || this.isProcessing) {
      if (!this.isProcessing) this.startNextRecording();
      return;
    }

    this.isProcessing = true;

    try {
      const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
      const audioBlob = new Blob(this.audioChunks, { type: mimeType });

      if (audioBlob.size < 1000) {
        console.log('Recording too short, skipping transcription.');
        this.startNextRecording();
        return;
      }

      console.log('Processing audio blob:', {
        size: audioBlob.size,
        type: audioBlob.type,
        language: this.currentLanguage
      });

      const result = await this.transcribeWithWhisper(audioBlob, mimeType);
      
      if (result.text && result.text.trim()) {
        this.onTranscriptUpdateCallback?.({
          text: result.text.trim(),
          final: true,
          language: result.language
        });
      } else {
        console.log('No speech detected in audio.');
        this.startNextRecording();
      }

    } catch (error) {
      console.error('Error processing recording:', error);
      this.startNextRecording();
    }
  }

  private async transcribeWithWhisper(audioBlob: Blob, mimeType: string): Promise<{ text: string; language?: string }> {
    try {
        const fileExtension = mimeType.split('/')[1].split(';')[0];
        const filename = `audio.${fileExtension}`;
        const audioFile = new File([audioBlob], filename, { type: mimeType });

      const formData = new FormData();
      formData.append('file', audioFile);
      formData.append('model', 'whisper-1');
      if (this.currentLanguage !== 'auto') {
        formData.append('language', this.currentLanguage);
      }
      formData.append('response_format', 'json');

      console.log(`Sending transcription request with language: ${this.currentLanguage}`);

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
      
      return {
        text: result.text || '',
        language: result.language || this.currentLanguage
      };

    } catch (error) {
      console.error('Whisper transcription error:', error);
      throw error;
    }
  }

  private startNextRecording(): void {
    this.isProcessing = false;
    
    if (!this.isPaused && this.stream) {
      setTimeout(() => {
        this.startRecording();
      }, 500);
    }
  }

  public pauseRecording(): void {
    console.log('Pausing recording...');
    this.isPaused = true;
    
    if (this.isRecording) {
      this.stopCurrentRecording();
    }
  }

  public resumeRecording(): void {
    console.log('Resuming recording...');
    this.isPaused = false;
    this.isProcessing = false;
    
    if (this.stream) {
      // Add a small delay to ensure the audio context is ready
      setTimeout(() => {
        this.startRecording();
      }, 1000); 
    }
  }

  public stopContinuousStreaming(): void {
    console.log('Stopping continuous streaming...');
    
    this.isPaused = true; // Set to paused to prevent automatic restarts
    
    if (this.isRecording) {
      this.stopCurrentRecording();
    }

    if (this.recordingTimeout) clearTimeout(this.recordingTimeout);
    if (this.silenceTimeout) clearTimeout(this.silenceTimeout);
    this.recordingTimeout = null;
    this.silenceTimeout = null;

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
  }
}