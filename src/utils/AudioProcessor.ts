export class AudioProcessor {
  private recognition: any = null;
  private isListening: boolean = false;
  private isPaused: boolean = false;
  private onTranscriptUpdateCallback: ((transcript: { text: string; final: boolean }) => void) | null = null;
  private onSpeechStartCallback: (() => void) | null = null;
  private lastTranscript: string = '';
  private transcriptTimeout: number | null = null;
  private isProcessing: boolean = false;
  private restartAttempts: number = 0;
  private maxRestartAttempts: number = 3;

  // Mobile detection
  private isMobile: boolean = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  private isAndroid: boolean = /Android/i.test(navigator.userAgent);

  constructor() {
    this.initializeSpeechRecognition();
    console.log('AudioProcessor initialized for:', this.isMobile ? 'Mobile' : 'Desktop', this.isAndroid ? '(Android)' : '');
  }

  private initializeSpeechRecognition(): void {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.error('Speech Recognition not supported in this browser');
      return;
    }

    this.recognition = new SpeechRecognition();
    
    // Android-optimized settings
    this.recognition.continuous = false; // Always false for mobile
    this.recognition.interimResults = false; // Always false for mobile
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;
    
    // Android-specific settings
    if (this.isAndroid) {
      this.recognition.serviceURI = null;
      // Shorter timeout for Android
      this.recognition.speechTimeout = 5000;
    }

    this.recognition.onstart = () => {
      console.log('Speech recognition started');
      this.isListening = true;
      this.restartAttempts = 0;
      this.onSpeechStartCallback?.();
    };

    this.recognition.onresult = (event: any) => {
      if (this.isPaused || this.isProcessing) {
        console.log('Recognition paused or processing, ignoring result');
        return;
      }

      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.trim();
        
        if (event.results[i].isFinal && transcript) {
          finalTranscript = transcript;
          break;
        }
      }

      if (finalTranscript && finalTranscript !== this.lastTranscript) {
        console.log('New final transcript:', finalTranscript);
        this.lastTranscript = finalTranscript;
        this.isProcessing = true;
        
        // Clear any existing timeout
        if (this.transcriptTimeout) {
          clearTimeout(this.transcriptTimeout);
        }

        // Send transcript and pause recognition
        this.pauseRecording();
        this.onTranscriptUpdateCallback?.({ 
          text: finalTranscript, 
          final: true 
        });

        // Reset processing flag after a delay
        this.transcriptTimeout = setTimeout(() => {
          this.isProcessing = false;
          this.lastTranscript = '';
        }, 3000) as unknown as number;
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      
      if (event.error === 'not-allowed') {
        console.error('Microphone access denied');
        alert('Microphone access is required. Please allow microphone access and try again.');
        return;
      }

      if (event.error === 'network') {
        console.error('Network error in speech recognition');
        if (this.restartAttempts < this.maxRestartAttempts) {
          this.restartAttempts++;
          setTimeout(() => {
            if (this.isListening && !this.isPaused) {
              this.startRecognition();
            }
          }, 2000);
        }
        return;
      }

      // Handle other errors more gracefully on Android
      if (this.isAndroid && (event.error === 'no-speech' || event.error === 'aborted')) {
        console.warn('Android speech recognition stopped, waiting for manual restart');
        // Don't auto-restart on Android, wait for user interaction
        return;
      }
    };

    this.recognition.onend = () => {
      console.log('Speech recognition ended');
      
      // Never auto-restart on mobile - always wait for user interaction
      if (this.isMobile) {
        console.log('Mobile: Speech recognition ended, waiting for manual restart');
        return;
      }
      
      // Only auto-restart on desktop
      if (this.isListening && !this.isPaused && !this.isProcessing) {
        setTimeout(() => {
          this.startRecognition();
        }, 100);
      }
    };
  }

  private startRecognition(): void {
    if (!this.recognition || this.isPaused || this.isProcessing) return;

    try {
      // Add user gesture check for mobile
      if (this.isMobile) {
        // Ensure we have user gesture context
        const hasUserGesture = document.hasStoredUserActivation || 
                               (document as any).wasUserActivated ||
                               true; // Assume true if we can't detect
        
        if (!hasUserGesture) {
          console.warn('No user gesture detected, speech recognition may fail');
        }
      }
      
      this.recognition.start();
    } catch (error: any) {
      console.error('Error starting recognition:', error);
      
      // Handle common Android errors
      if (error.name === 'InvalidStateError') {
        console.log('Recognition already running, stopping and restarting...');
        try {
          this.recognition.stop();
          setTimeout(() => {
            if (this.isListening && !this.isPaused) {
              this.recognition.start();
            }
          }, 500);
        } catch (e) {
          console.error('Error restarting recognition:', e);
        }
      }
    }
  }

  async startContinuousStreaming(
    onTranscriptUpdate: (transcript: { text: string; final: boolean }) => void,
    onSpeechStart: () => void
  ): Promise<void> {
    this.onTranscriptUpdateCallback = onTranscriptUpdate;
    this.onSpeechStartCallback = onSpeechStart;

    if (!this.recognition) {
      throw new Error('Speech recognition not available');
    }

    // Request microphone permission explicitly on mobile
    if (this.isMobile) {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('Microphone permission granted');
      } catch (error) {
        console.error('Microphone permission denied:', error);
        throw new Error('Microphone access is required for voice input');
      }
    }

    try {
      this.isListening = true;
      this.isPaused = false;
      this.isProcessing = false;
      this.lastTranscript = '';
      this.restartAttempts = 0;
      
      this.startRecognition();
      console.log('Started speech recognition for:', this.isMobile ? 'Mobile' : 'Desktop');
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      throw new Error('Failed to start speech recognition');
    }
  }

  pauseRecording(): void {
    console.log('Pausing speech recognition...');
    this.isPaused = true;
    
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (error) {
        console.error('Error pausing recognition:', error);
      }
    }
  }

  resumeRecording(): void {
    console.log('Resuming speech recognition...');
    this.isPaused = false;
    this.isProcessing = false;
    
    // On mobile, always require manual restart
    if (this.isMobile) {
      console.log('Mobile: Use restartRecognition() to manually restart');
      return;
    }
    
    if (this.isListening && !this.isProcessing) {
      setTimeout(() => {
        this.startRecognition();
      }, 500);
    }
  }

  // Enhanced method for mobile to manually restart recognition with user gesture
  restartRecognition(): void {
    console.log('Manual restart requested');
    
    if (!this.isListening || this.isPaused || this.isProcessing) {
      console.log('Cannot restart: not listening, paused, or processing');
      return;
    }
    
    // Stop current recognition if running
    try {
      this.recognition.stop();
    } catch (error) {
      console.error('Error stopping recognition for restart:', error);
    }
    
    // Start new recognition after short delay
    setTimeout(() => {
      this.startRecognition();
    }, 100);
  }

  stopContinuousStreaming(): void {
    console.log('Stopping speech recognition...');
    
    this.isListening = false;
    this.isPaused = false;
    this.isProcessing = false;
    this.lastTranscript = '';
    this.restartAttempts = 0;
    
    if (this.transcriptTimeout) {
      clearTimeout(this.transcriptTimeout);
      this.transcriptTimeout = null;
    }
    
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
    }
  }
}