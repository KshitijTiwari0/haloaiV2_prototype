import { AudioProcessor } from './AudioProcessor';
import { EmotionDetector } from './EmotionDetector';
import { ResponseGenerator } from './ResponseGenerator';
import { TextToSpeechEngine } from './TextToSpeechEngine';
import { ConfigManager } from './ConfigManager';
import { Interaction, DatabaseInteraction } from '../types';
import { supabase } from '../lib/supabase';

export class EmotionalAICompanion {
  private audioProcessor: AudioProcessor;
  private emotionDetector: EmotionDetector;
  private responseGenerator: ResponseGenerator;
  private ttsEngine: TextToSpeechEngine;
  private configManager: ConfigManager;
  private isCallActive: boolean = false;
  private currentUserId: string | null = null;
  
  // Callback functions
  private onSpeechStartCallback: (() => void) | null = null;
  private onSpeechEndCallback: (() => void) | null = null;
  private onProcessingStartCallback: (() => void) | null = null;
  private onProcessingEndCallback: (() => void) | null = null;
  private onAISpeakingStartCallback: (() => void) | null = null;
  private onAISpeakingEndCallback: (() => void) | null = null;

  constructor(openaiApiKey: string, elevenLabsApiKey: string, configManager: ConfigManager) {
    this.configManager = configManager;

    // Validate required API keys
    if (!openaiApiKey) {
      throw new Error('OpenAI API key is required');
    }
    if (!elevenLabsApiKey) {
      throw new Error('Eleven Labs API key is required');
    }

    // Store API keys in config manager
    this.configManager.set('openai_api_key', openaiApiKey);
    this.configManager.set('eleven_labs_api_key', elevenLabsApiKey);

    // Initialize components
    this.audioProcessor = new AudioProcessor();
    this.emotionDetector = new EmotionDetector();
    this.responseGenerator = new ResponseGenerator(openaiApiKey);
    this.ttsEngine = new TextToSpeechEngine(
      elevenLabsApiKey,
      configManager.get('voice_id') || "21m00Tcm4TlvDq8ikWAM"
    );
    
    // Connect TTS engine with audio processor
    this.ttsEngine.setAudioProcessor(this.audioProcessor);
    
    // Set up TTS callbacks
    this.ttsEngine.setOnSpeakingStart(() => {
      this.onAISpeakingStartCallback?.();
    });
    
    this.ttsEngine.setOnSpeakingEnd(() => {
      this.onAISpeakingEndCallback?.();
    });
    
    this.initializeUser();
    
    console.log('EmotionalAICompanion initialized with OpenAI + Eleven Labs');
  }

  private async initializeUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      this.currentUserId = user?.id || null;
      if (this.currentUserId) {
        console.log('AI Companion initialized for user:', user?.email);
        
        // Validate API keys on initialization
        const validation = this.configManager.validateConfiguration();
        if (!validation.valid) {
          console.warn('Missing required configuration:', validation.missing);
        }
      }
    } catch (error) {
      console.error('Error initializing user:', error);
    }
  }

  // Existing callback setters
  public setOnSpeechStart(callback: () => void) { this.onSpeechStartCallback = callback; }
  public setOnSpeechEnd(callback: () => void) { this.onSpeechEndCallback = callback; }
  public setOnProcessingStart(callback: () => void) { this.onProcessingStartCallback = callback; }
  public setOnProcessingEnd(callback: () => void) { this.onProcessingEndCallback = callback; }
  
  // New callback setters for AI speaking
  public setOnAISpeakingStart(callback: () => void) { this.onAISpeakingStartCallback = callback; }
  public setOnAISpeakingEnd(callback: () => void) { this.onAISpeakingEndCallback = callback; }

  private async onTranscriptUpdate(transcript: { text: string; final: boolean }): Promise<void> {
    if (!transcript.final || !transcript.text.trim()) return;
    
    console.log('Final User Transcript:', transcript.text);
    this.onSpeechEndCallback?.(); // User finished speaking
    this.onProcessingStartCallback?.(); // Start processing
    
    try {
      // Since we're using Whisper now, we don't have real-time audio features
      // We'll provide a simple description based on the transcript
      const featureDescription = this.generateFeatureDescriptionFromText(transcript.text);
      
      await this.processAndRespond(transcript.text, featureDescription);
    } catch (error) {
      console.error('Error processing transcript:', error);
      
      // Provide fallback response for errors
      try {
        await this.ttsEngine.speakText("I'm having trouble understanding. Could you please try again?");
      } catch (ttsError) {
        console.error('Error with fallback TTS:', ttsError);
      }
    } finally {
      this.onProcessingEndCallback?.();
    }
  }

  private generateFeatureDescriptionFromText(text: string): string {
    // Simple text analysis to provide context for the AI
    const wordCount = text.split(' ').length;
    const hasQuestionMarks = text.includes('?');
    const hasExclamations = text.includes('!');
    const allCaps = text === text.toUpperCase() && text.length > 5;
    
    let description = `Text analysis: ${wordCount} words`;
    
    if (hasQuestionMarks) description += ", questioning tone";
    if (hasExclamations) description += ", excited/emphatic tone";
    if (allCaps) description += ", emphasized/loud tone";
    if (wordCount < 3) description += ", brief response";
    if (wordCount > 20) description += ", lengthy response";
    
    return description;
  }
  
  private async processAndRespond(transcribedText: string, featureDescription: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Get recent conversation history
      const recentInteractions = await this.getRecentInteractions();
      
      // Generate response using streaming
      const responseStream = this.responseGenerator.generateResponseStream(
        transcribedText, 
        featureDescription, 
        recentInteractions
      );

      let fullAIResponse = "";
      let finalMood: string | null = null;

      // Process streaming response
      for await (const result of responseStream) {
        if (result.isFinal) {
          fullAIResponse = result.fullResponse;
          finalMood = result.mood;
        }
      }
      
      if (fullAIResponse && fullAIResponse.trim()) {
        console.log('AI response:', fullAIResponse);
        
        // Speak the response
        await this.ttsEngine.speakText(fullAIResponse);
        console.log('AI finished speaking');

        // Save interaction to database
        const interaction: Interaction = {
          timestamp: new Date().toISOString(),
          user_input: transcribedText,
          feature_description: featureDescription,
          ai_response: fullAIResponse,
          response_time: (Date.now() - startTime) / 1000,
          user_mood: finalMood || 'neutral'
        };
        
        await this.saveInteraction(interaction);
      } else {
        console.warn('No response generated from AI');
        // Provide fallback response
        await this.ttsEngine.speakText("I'm not sure how to respond to that. Could you tell me more?");
      }
      
    } catch (error) {
      console.error('Error in processAndRespond:', error);
      
      // Provide error fallback
      try {
        await this.ttsEngine.speakText("I'm having some technical difficulties. Please try again in a moment.");
      } catch (ttsError) {
        console.error('Error with error fallback TTS:', ttsError);
      }
    }
  }

  public async startCall(): Promise<void> {
    if (this.isCallActive) {
      console.warn('Call is already active');
      return;
    }

    try {
      // Validate configuration before starting
      const validation = this.configManager.validateConfiguration();
      if (!validation.valid) {
        throw new Error(`Missing required configuration: ${validation.missing.join(', ')}`);
      }

      this.isCallActive = true;
      console.log('Starting call...');
      
      // Start audio processing with Whisper
      await this.audioProcessor.startContinuousStreaming(
        this.onTranscriptUpdate.bind(this),
        () => this.onSpeechStartCallback?.()
      );
      
      console.log('Call started successfully');
    } catch (error) {
      this.isCallActive = false;
      console.error('Error starting call:', error);
      throw error;
    }
  }

  public stopCall(): void {
    if (!this.isCallActive) {
      console.warn('Call is not active');
      return;
    }

    try {
      this.isCallActive = false;
      console.log('Stopping call...');
      
      // Stop audio processing
      this.audioProcessor.stopContinuousStreaming();
      
      console.log('Call stopped successfully');
    } catch (error) {
      console.error('Error stopping call:', error);
    }
  }

  private async saveInteraction(interaction: Interaction): Promise<void> {
    if (!this.currentUserId) {
      console.warn('No user ID available, skipping interaction save');
      return;
    }

    try {
      const { error } = await supabase.from('interactions').insert([{
        user_id: this.currentUserId,
        timestamp: interaction.timestamp,
        user_input: interaction.user_input,
        ai_response: interaction.ai_response,
        feature_description: interaction.feature_description,
        response_time: interaction.response_time,
        user_mood: interaction.user_mood,
      }]);

      if (error) {
        console.error('Error saving interaction:', error);
      } else {
        console.log('Interaction saved successfully');
      }
    } catch (error) {
      console.error('Exception saving interaction:', error);
    }
  }

  private async getRecentInteractions(limit: number = 5): Promise<DatabaseInteraction[]> {
    if (!this.currentUserId) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('interactions')
        .select('*')
        .eq('user_id', this.currentUserId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching interactions:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Exception fetching interactions:', error);
      return [];
    }
  }

  // Utility methods
  public isActive(): boolean {
    return this.isCallActive;
  }

  public async validateSetup(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    // Check configuration
    const configValidation = this.configManager.validateConfiguration();
    if (!configValidation.valid) {
      errors.push(...configValidation.missing.map(item => `Missing ${item}`));
    }

    // Check Eleven Labs API key
    try {
      const isElevenLabsValid = await this.ttsEngine.validateApiKey();
      if (!isElevenLabsValid) {
        errors.push('Invalid Eleven Labs API key');
      }
    } catch (error) {
      errors.push('Unable to validate Eleven Labs API key');
    }

    // Check microphone access
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      errors.push('Microphone access denied or unavailable');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  public getConfigSummary(): Record<string, any> {
    return this.configManager.getConfigSummary();
  }

  // Voice management
  public async getAvailableVoices(): Promise<any[]> {
    return await this.ttsEngine.getAvailableVoices();
  }

  public setVoice(voiceId: string): void {
    this.ttsEngine.setVoiceId(voiceId);
    this.configManager.set('voice_id', voiceId);
  }

  public getCurrentVoiceId(): string {
    return this.ttsEngine.getVoiceId();
  }
}