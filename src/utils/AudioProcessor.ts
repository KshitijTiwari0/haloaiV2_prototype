export class AudioProcessor {
  private recognition: any = null;
  private isListening: boolean = false;
  private onTranscriptUpdateCallback: ((transcript: { text: string; final: boolean }) => void) | null = null;
  private onSpeechStartCallback: (() => void) | null = null;

  constructor() {
    this.initializeSpeechRecognition();
  }

  private initializeSpeechRecognition(): void {
    // Check if speech recognition is available
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.error('Speech Recognition not supported in this browser');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      console.log('Speech recognition started');
      this.isListening = true;
      this.onSpeechStartCallback?.();
    };

    this.recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Send interim results
      if (interimTranscript) {
        this.onTranscriptUpdateCallback?.({ 
          text: interimTranscript, 
          final: false 
        });
      }

      // Send final results
      if (finalTranscript) {
        console.log('Final transcript:', finalTranscript);
        this.onTranscriptUpdateCallback?.({ 
          text: finalTranscript, 
          final: true 
        });
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      
      if (event.error === 'not-allowed') {
        console.error('Microphone access denied');
      } else if (event.error === 'no-speech') {
        console.warn('No speech detected, restarting...');
        // Restart recognition after a short delay
        setTimeout(() => {
          if (this.isListening) {
            this.recognition.start();
          }
        }, 1000);
      }
    };

    this.recognition.onend = () => {
      console.log('Speech recognition ended');
      
      // Auto-restart if we're still supposed to be listening
      if (this.isListening) {
        setTimeout(() => {
          try {
            this.recognition.start();
          } catch (error) {
            console.error('Error restarting recognition:', error);
          }
        }, 100);
      }
    };
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
      this.recognition.start();
      console.log('Started browser speech recognition');
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      throw new Error('Failed to start speech recognition');
    }
  }

  stopContinuousStreaming(): void {
    console.log('Stopping speech recognition...');
    
    this.isListening = false;
    
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
    }
  }
}