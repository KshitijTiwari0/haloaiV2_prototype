import { AudioProcessor } from './AudioProcessor';
import { EmotionDetector } from './EmotionDetector';
import { ResponseGenerator } from './ResponseGenerator';
import { TextToSpeechEngine } from './TextToSpeechEngine';
import { ConfigManager } from './ConfigManager';
import { Interaction, DatabaseInteraction, UserProfile } from '../types';
import { supabase } from '../lib/supabase';

export class EmotionalAICompanion {
  private audioProcessor: AudioProcessor;
  private emotionDetector: EmotionDetector;
  private responseGenerator: ResponseGenerator;
  private ttsEngine: TextToSpeechEngine;
  private configManager: ConfigManager;
  private conversationLog: Interaction[] = [];
  private currentUserId: string | null = null;
  private isCallActive: boolean = false;

  // Callbacks to update the UI
  private onSpeechStartCallback: (() => void) | null = null;
  private onSpeechEndCallback: (() => void) | null = null;
  private onProcessingStartCallback: (() => void) | null = null;
  private onProcessingEndCallback: (() => void) | null = null;

  constructor(openrouterApiKey: string, configManager: ConfigManager) {
    this.configManager = configManager;
    this.audioProcessor = new AudioProcessor();
    this.emotionDetector = new EmotionDetector();
    this.responseGenerator = new ResponseGenerator(openrouterApiKey);
    this.ttsEngine = new TextToSpeechEngine(
      configManager.get('eleven_labs_api_key'),
      configManager.get('voice_id') || "21m00Tcm4TlvDq8ikWAM"
    );
    this.initializeUser();
  }

  private async initializeUser(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        this.currentUserId = user.id;
        console.log('AI Companion initialized for user:', user.email);
      }
    } catch (error) {
      console.error('Error initializing user:', error);
    }
  }

  // Methods to set the callbacks from the UI
  public setOnSpeechStart(callback: () => void) {
    this.onSpeechStartCallback = callback;
  }

  public setOnSpeechEnd(callback: () => void) {
    this.onSpeechEndCallback = callback;
  }

  public setOnProcessingStart(callback: () => void) {
    this.onProcessingStartCallback = callback;
  }

  public setOnProcessingEnd(callback: () => void) {
    this.onProcessingEndCallback = callback;
  }

  async getRecentInteractions(limit: number = 5): Promise<DatabaseInteraction[]> {
    if (!this.currentUserId) {
      console.warn('No authenticated user for retrieving interactions');
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
      console.error('Error retrieving recent interactions:', error);
      return [];
    }
  }

  async getUserProfile(): Promise<Record<string, any>> {
    if (!this.currentUserId) {
      console.warn('No authenticated user for retrieving profile');
      return {};
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('preferences')
        .eq('user_id', this.currentUserId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No profile exists yet, create one
          await this.createUserProfile();
          return {};
        }
        console.error('Error fetching user profile:', error);
        return {};
      }

      return data?.preferences || {};
    } catch (error) {
      console.error('Error retrieving user profile:', error);
      return {};
    }
  }

  private async createUserProfile(): Promise<void> {
    if (!this.currentUserId) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .insert({
          user_id: this.currentUserId,
          preferences: {}
        });

      if (error) {
        console.error('Error creating user profile:', error);
      } else {
        console.log('User profile created successfully');
      }
    } catch (error) {
      console.error('Error creating user profile:', error);
    }
  }

  async updateUserProfile(preferences: Record<string, any>): Promise<void> {
    if (!this.currentUserId) {
      console.warn('No authenticated user for updating profile');
      return;
    }

    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: this.currentUserId,
          preferences: preferences
        });

      if (error) {
        console.error('Error updating user profile:', error);
      } else {
        console.log('User profile updated successfully');
      }
    } catch (error) {
      console.error('Error updating user profile:', error);
    }
  }

  private async saveInteraction(interaction: Interaction): Promise<void> {
    if (!this.currentUserId) {
      console.warn('No authenticated user for saving interaction');
      return;
    }

    try {
      const { error } = await supabase
        .from('interactions')
        .insert({
          user_id: this.currentUserId,
          timestamp: interaction.timestamp,
          user_input: interaction.user_input,
          ai_response: interaction.ai_response,
          feature_description: interaction.feature_description,
          response_time: interaction.response_time,
          user_mood: interaction.user_mood || null
        });

      if (error) {
        console.error('Error saving interaction:', error);
      } else {
        console.log('Interaction saved to database successfully', {
          mood: interaction.user_mood,
          user_input: interaction.user_input.substring(0, 50) + '...'
        });
      }
    } catch (error) {
      console.error('Error saving interaction:', error);
    }
  }

  async startRecording(): Promise<void> {
    await this.audioProcessor.startRecording();
  }

  async recordWithVAD(): Promise<Blob | null> {
    const maxDuration = this.configManager.get('max_duration') || 10;
    const silenceThreshold = this.configManager.get('silence_threshold') || 0.01;
    return await this.audioProcessor.recordWithVAD(maxDuration, silenceThreshold);
  }

  async processAudio(audioBlob: Blob, transcribedText?: string): Promise<Interaction | null> {
    try {
      const startTime = Date.now();
      
      const emotionResult = await this.emotionDetector.detectEmotion(audioBlob);
      const features = emotionResult.features;
      
      if (transcribedText && features.duration && features.duration > 0) {
        const numWords = transcribedText.split(' ').length;
        const speakingRate = (numWords / features.duration) * 60;
        features.speaking_rate = speakingRate;
      }

      const description = emotionResult.description;
      const userInput = transcribedText || "Audio input processed";

      const recentInteractions = await this.getRecentInteractions(3);
      const userPreferences = await this.getUserProfile();

      const llmResponse = await this.responseGenerator.generateResponse(
        userInput, 
        description, 
        recentInteractions, 
        userPreferences
      );
      
      if (llmResponse.ai_response) {
        console.log(`Generated response: ${llmResponse.ai_response}`);
        console.log(`AI-detected user mood: ${llmResponse.user_mood}`);
        await this.ttsEngine.speakText(llmResponse.ai_response);
      } else {
        console.warn('No response text generated, skipping TTS');
        throw new Error('No response text generated');
      }

      const userMood = llmResponse.user_mood;

      const interaction: Interaction = {
        timestamp: new Date().toISOString(),
        user_input: userInput,
        feature_description: description,
        ai_response: llmResponse.ai_response,
        response_time: (Date.now() - startTime) / 1000,
        user_mood: userMood
      };

      this.conversationLog.push(interaction);
      await this.saveInteraction(interaction);
      
      console.log(`Interaction logged - Response time: ${interaction.response_time.toFixed(2)}s, Mood: ${userMood}`);
      
      return interaction;
    } catch (error) {
      console.error('Processing error:', error);
      throw error;
    }
  }

  async transcribeAudio(audioBlob: Blob): Promise<string | null> {
    const config = {
      openai_api_key: this.configManager.get('openai_api_key'),
      assemblyai_api_key: this.configManager.get('assemblyai_api_key'),
      transcription_method: this.configManager.get('transcription_method') || 'auto'
    };
    
    return await this.audioProcessor.transcribeAudio(audioBlob, config);
  }

  getConversationLog(): Interaction[] {
    return [...this.conversationLog];
  }

  async startCall(): Promise<void> {
    if (this.isCallActive) {
      console.warn('Call is already active');
      return;
    }

    try {
      this.isCallActive = true;
      console.log('Starting continuous call...');

      const silenceThreshold = this.configManager.get('silence_threshold') || 0.01;

      await this.audioProcessor.startContinuousRecording(
        this.onUtteranceEnd.bind(this),
        this.onSpeechStart.bind(this),
        this.onSilence.bind(this),
        silenceThreshold
      );

      console.log('Continuous call started successfully');
    } catch (error) {
      console.error('Error starting call:', error);
      this.isCallActive = false;
      throw error;
    }
  }

  stopCall(): void {
    if (!this.isCallActive) {
      console.warn('No active call to stop');
      return;
    }

    console.log('Stopping continuous call...');
    this.audioProcessor.stopContinuousRecording();
    this.isCallActive = false;
    console.log('Call ended');
  }

  isCallInProgress(): boolean {
    return this.isCallActive;
  }

  private async onUtteranceEnd(audioBlob: Blob): Promise<void> {
    try {
      console.log('Processing user utterance...');
      this.onProcessingStartCallback?.(); // MODIFIED: Start processing state
      this.audioProcessor.setAITalking(true);

      const transcribedText = await this.transcribeAudio(audioBlob);
      
      if (!transcribedText) {
        console.warn('No transcription available, skipping response');
        this.audioProcessor.setAITalking(false);
        this.onProcessingEndCallback?.(); // MODIFIED: End processing state
        return;
      }

      console.log('User said:', transcribedText);

      const interaction = await this.processAudio(audioBlob, transcribedText);
      
      if (interaction) {
        console.log('AI responded:', interaction.ai_response);
      }

      this.audioProcessor.setAITalking(false);
      this.onProcessingEndCallback?.(); // MODIFIED: End processing state
      console.log('Ready for next user input');

    } catch (error) {
      console.error('Error processing utterance:', error);
      this.audioProcessor.setAITalking(false);
      this.onProcessingEndCallback?.(); // MODIFIED: End processing state on error
    }
  }

  private onSpeechStart(): void {
    console.log('User started speaking');
    this.onSpeechStartCallback?.(); // MODIFIED: Notify UI that user is speaking
  }

  private onSilence(): void {
    this.onSpeechEndCallback?.(); // MODIFIED: Notify UI that user has stopped speaking
  }
}