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
  private isIOS: boolean;

  // Configuration - adjusted for iOS
  private readonly MAX_RECORDING_TIME = 30000; // 30 seconds
  private readonly SILENCE_TIMEOUT = 3000; // 3 seconds of silence
  private readonly MIN_RECORDING_TIME = 1000; // 1 second minimum

  constructor() {
    // Detect iOS
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                 (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    console.log('AudioProcessor initialized for:', this.isIOS ? 'iOS' : 'Desktop');
  }

  // Set the language for transcription
  setLanguage(language: SupportedLanguage): void {
    this.currentLanguage = language;
    console.log(`AudioProcessor language set to: ${language}`);
  }

  // Get current language setting
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
      // iOS-specific constraints
      const constraints = this.isIOS ? {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          // Remove sampleRate constraint for iOS
        }
      } : {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        }
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      // iOS requires immediate user interaction
      if (this.isIOS) {
        await this.initializeIOSAudio();
      }

      this.isPaused = false;
      this.isProcessing = false;
      
      await this.startRecording();
      console.log(`Started continuous audio streaming for Whisper (language: ${language}) on ${this.isIOS ? 'iOS' : 'Desktop'}`);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      if (this.isIOS) {
        throw new Error('Microphone access failed on iOS. Please ensure you granted permission and try again.');
      }
      throw new Error('Failed to access microphone. Please check permissions.');
    }
  }

  private async initializeIOSAudio(): Promise<void> {
    try {
      // Create a dummy audio context to unlock iOS audio
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      // Create a brief silent sound to unlock audio
      const buffer = audioContext.createBuffer(1, 1, 22050);
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.start();
      
      await audioContext.close();
      console.log('iOS audio initialized successfully');
    } catch (error) {
      console.error('iOS audio initialization failed:', error);
    }
  }

  private async startRecording(): Promise<void> {
    if (!this.stream || this.isPaused || this.isProcessing) return;

    try {
      // Clear any existing chunks
      this.audioChunks = [];

      // iOS-compatible MediaRecorder options
      const supportedFormats = this.isIOS ? [
        'audio/mp4',
        'audio/aac',
        'audio/wav',
        'audio/m4a'
      ] : [
        'audio/webm;codecs=opus',
        'audio/mp4;codecs=mp4a.40.2',
        'audio/webm',
        'audio/mp4'
      ];

      let selectedFormat = 'audio/wav'; // Fallback
      for (const format of supportedFormats) {
        if (MediaRecorder.isTypeSupported(format)) {
          selectedFormat = format;
          break;
        }
      }

      const options: MediaRecorderOptions = {
        mimeType: selectedFormat
      };

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

      // Start recording - shorter data collection interval for iOS
      const dataInterval = this.isIOS ? 500 : 250;
      this.mediaRecorder.start(dataInterval);
      this.isRecording = true;
      this.onSpeechStartCallback?.();

      // Set maximum recording time - shorter for iOS
      const maxRecordingTime = this.isIOS ? 15000 : this.MAX_RECORDING_TIME;
      this.recordingTimeout = setTimeout(() => {
        this.stopCurrentRecording();
      }, maxRecordingTime) as unknown as number;

      // Set silence detection timeout - shorter for iOS
      const silenceTimeout = this.isIOS ? 2000 : this.SILENCE_TIMEOUT;
      this.resetSilenceTimeout(silenceTimeout);

      console.log(`Recording started (${selectedFormat}) on ${this.isIOS ? 'iOS' : 'Desktop'}`);
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }

  private resetSilenceTimeout(timeout: number = this.SILENCE_TIMEOUT): void {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
    }

    this.silenceTimeout = setTimeout(() => {
      console.log('Silence detected, stopping recording');
      this.stopCurrentRecording();
    }, timeout) as unknown as number;
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
        chunks: this.audioChunks.length,
        language: this.currentLanguage,
        platform: this.isIOS ? 'iOS' : 'Desktop'
      });

      // Send to transcription with language preference
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
      // Convert to the format expected by Whisper API
      let audioFile: File;
      
      if (this.isIOS && audioBlob.type.includes('m4a')) {
        audioFile = new File([audioBlob], 'audio.m4a', {
          type: 'audio/m4a'
        });
      } else if (this.isIOS && audioBlob.type.includes('mp4')) {
        audioFile = new File([audioBlob], 'audio.mp4', {
          type: 'audio/mp4'
        });
      } else {
        audioFile = new File([audioBlob], 'audio.webm', {
          type: audioBlob.type
        });
      }

      // Call Netlify function for Whisper transcription
      const formData = new FormData();
      formData.append('file', audioFile);
      formData.append('model', 'whisper-1');
      formData.append('language', this.currentLanguage);

      console.log(`Sending transcription request with language: ${this.currentLanguage} from ${this.isIOS ? 'iOS' : 'Desktop'}`);

      // iOS might need longer timeout
      const timeoutMs = this.isIOS ? 60000 : 30000;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch('/.netlify/functions/transcribe-audio', {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

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
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Transcription timeout - please try speaking more clearly');
        }
        throw error;
      }

    } catch (error) {
      console.error('Whisper transcription error:', error);
      throw error;
    }
  }

  private startNextRecording(): void {
    this.isProcessing = false;
    
    // Start next recording if not paused - longer delay for iOS
    if (!this.isPaused && this.stream) {
      const delay = this.isIOS ? 1000 : 500;
      setTimeout(() => {
        this.startRecording();
      }, delay);
    }
  }

  pauseRecording(): void {
    console.log(`Pausing recording on ${this.isIOS ? 'iOS' : 'Desktop'}...`);
    this.isPaused = true;
    
    if (this.isRecording) {
      this.stopCurrentRecording();
    }
  }

  resumeRecording(): void {
    console.log(`Resuming recording on ${this.isIOS ? 'iOS' : 'Desktop'}...`);
    this.isPaused = false;
    this.isProcessing = false;
    
    if (this.stream) {
      // Longer delay for iOS to ensure clean audio separation
      const delay = this.isIOS ? 1500 : 1000;
      setTimeout(() => {
        this.startRecording();
      }, delay);
    }
  }

  stopContinuousStreaming(): void {
    console.log(`Stopping continuous streaming on ${this.isIOS ? 'iOS' : 'Desktop'}...`);
    
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

  // Get supported languages for display
  getSupportedLanguages(): { code: SupportedLanguage; name: string }[] {
    return [
      { code: 'auto', name: 'Auto Detect' },
      { code: 'en', name: 'English' },
      { code: 'hi', name: 'हिन्दी (Hindi)' },
      { code: 'ar', name: 'العربية (Arabic)' }
    ];
  }

  // Check if a language is supported
  isLanguageSupported(language: string): boolean {
    return ['auto', 'en', 'hi', 'ar'].includes(language);
  }

  // Get language display name
  getLanguageDisplayName(language: SupportedLanguage): string {
    const names = {
      'auto': 'Auto Detect',
      'en': 'English',
      'hi': 'हिन्दी (Hindi)',
      'ar': 'العربية (Arabic)'
    };
    return names[language] || 'Unknown';
  }

  // Get iOS status
  getIsIOS(): boolean {
    return this.isIOS;
  }
}