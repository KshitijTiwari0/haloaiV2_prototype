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

  private readonly MAX_RECORDING_TIME = 30000;
  private readonly SILENCE_TIMEOUT = 3000;
  private readonly MIN_RECORDING_TIME = 1000;

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
    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw new Error('Failed to access microphone. Please check permissions.');
    }
  }

  private async startRecording(): Promise<void> {
    if (!this.stream || this.isPaused || this.isProcessing) return;

    try {
      this.audioChunks = [];

      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const supportedFormats = isIOS ? 
        ['audio/mp4', 'audio/aac'] : 
        ['audio/webm;codecs=opus', 'audio/mp4'];

      let selectedFormat = 'audio/wav';
      for (const format of supportedFormats) {
        if (MediaRecorder.isTypeSupported(format)) {
          selectedFormat = format;
          break;
        }
      }

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
      };

      this.mediaRecorder.start(250);
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
      console.log('Silence detected, stopping recording');
      this.stopCurrentRecording();
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
      console.error('Error stopping recording:', error);
    }
  }

  private async processRecording(): Promise<void> {
    if (this.audioChunks.length === 0 || this.isProcessing) return;

    this.isProcessing = true;

    try {
      const audioBlob = new Blob(this.audioChunks, { 
        type: this.mediaRecorder?.mimeType || 'audio/webm' 
      });

      if (audioBlob.size < 1000) {
        console.log('Recording too short, skipping transcription');
        this.startNextRecording();
        return;
      }

      console.log('Processing audio blob:', {
        size: audioBlob.size,
        type: audioBlob.type,
        chunks: this.audioChunks.length,
        language: this.currentLanguage
      });

      const result = await this.transcribeWithWhisper(audioBlob);
      
      if (result.text && result.text.trim()) {
        console.log('Whisper transcript:', {
          text: result.text,
          detectedLanguage: result.language,
          requestedLanguage: this.currentLanguage
        });
        
        this.onTranscriptUpdateCallback?.({
          text: result.text.trim(),
          final: true,
          language: result.language
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

  private async transcribeWithWhisper(audioBlob: Blob): Promise<{ text: string; language?: string }> {
    try {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      let audioFile: File;
      
      if (isIOS && audioBlob.type.includes('mp4')) {
        audioFile = new File([audioBlob], 'audio.mp4', { type: 'audio/mp4' });
      } else if (isIOS && audioBlob.type.includes('aac')) {
        audioFile = new File([audioBlob], 'audio.aac', { type: 'audio/aac' });
      } else {
        audioFile = new File([audioBlob], 'audio.webm', { type: audioBlob.type });
      }

      const formData = new FormData();
      formData.append('file', audioFile);
      formData.append('model', 'whisper-1');
      formData.append('language', this.currentLanguage);

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
    
    if (this.isRecording) {
      this.stopCurrentRecording();
    }

    if (this.recordingTimeout) {
      clearTimeout(this.recordingTimeout);
      this.recordingTimeout = null;
    }
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
  }

  restartRecording(): void {
    if (!this.isPaused && !this.isProcessing && this.stream) {
      this.startRecording();
    }
  }

  getSupportedLanguages(): { code: SupportedLanguage; name: string }[] {
    return [
      { code: 'auto', name: 'Auto Detect' },
      { code: 'en', name: 'English' },
      { code: 'hi', name: 'हिन्दी (Hindi)' },
      { code: 'ar', name: 'العربية (Arabic)' }
    ];
  }

  isLanguageSupported(language: string): boolean {
    return ['auto', 'en', 'hi', 'ar'].includes(language);
  }

  getLanguageDisplayName(language: SupportedLanguage): string {
    const names = {
      'auto': 'Auto Detect',
      'en': 'English',
      'hi': 'हिन्दी (Hindi)',
      'ar': 'العربية (Arabic)'
    };
    return names[language] || 'Unknown';
  }
}