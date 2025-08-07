export class AudioProcessor {
  private recognition: any = null;
  private isListening: boolean = false;
  private isPaused: boolean = false;
  private onTranscriptUpdateCallback: ((transcript: { text: string; final: boolean }) => void) | null = null;
  private onSpeechStartCallback: (() => void) | null = null;
  private lastTranscript: string = '';
  private transcriptTimeout: number | null = null;
  private isProcessing: boolean = false;

  // Mobile detection
  private isMobile: boolean = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  constructor() {
    this.initializeSpeechRecognition();
    console.log('AudioProcessor initialized for:', this.isMobile ? 'Mobile' : 'Desktop');
  }

  private initializeSpeechRecognition(): void {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.error('Speech Recognition not supported in this browser');
      return;
    }

    this.recognition = new SpeechRecognition();
    
    // Mobile-optimized settings
    this.recognition.continuous = !this.isMobile; // Less continuous on mobile
    this.recognition.interimResults = !this.isMobile; // Disable interim on mobile
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    // Mobile-specific settings
    if (this.isMobile) {
      this.recognition.serviceURI = null; // Use default
    }

    this.recognition.onstart = () => {
      console.log('Speech recognition started');
      this.isListening = true;
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
          break; // Only take the first final result
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
        return;
      }

      // Don't auto-restart on mobile errors
      if (!this.isMobile && event.error === 'no-speech') {
        console.warn('No speech detected, restarting...');
        setTimeout(() => {
          if (this.isListening && !this.isPaused) {
            this.startRecognition();
          }
        }, 1000);
      }
    };

    this.recognition.onend = () => {
      console.log('Speech recognition ended');
      
      // Only auto-restart on desktop and if not paused
      if (!this.isMobile && this.isListening && !this.isPaused && !this.isProcessing) {
        setTimeout(() => {
          this.startRecognition();
        }, 100);
      }
    };
  }

  private startRecognition(): void {
    if (!this.recognition || this.isPaused || this.isProcessing) return;

    try {
      this.recognition.start();
    } catch (error) {
      console.error('Error starting recognition:', error);
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

    try {
      this.isListening = true;
      this.isPaused = false;
      this.isProcessing = false;
      this.lastTranscript = '';
      
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
    
    if (this.isListening && !this.isProcessing) {
      // On mobile, require user interaction to restart
      if (this.isMobile) {
        console.log('Mobile: Recognition will restart on next user interaction');
      } else {
        setTimeout(() => {
          this.startRecognition();
        }, 500);
      }
    }
  }

  // Add method for mobile to manually restart recognition
  restartRecognition(): void {
    if (this.isMobile && this.isListening && !this.isPaused && !this.isProcessing) {
      this.startRecognition();
    }
  }

  stopContinuousStreaming(): void {
    console.log('Stopping speech recognition...');
    
    this.isListening = false;
    this.isPaused = false;
    this.isProcessing = false;
    this.lastTranscript = '';
    
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