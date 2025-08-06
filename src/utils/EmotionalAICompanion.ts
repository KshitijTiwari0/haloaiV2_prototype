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

  private async initializeUser() {
      const { data: { user } } = await supabase.auth.getUser();
      this.currentUserId = user?.id || null;
      if (this.currentUserId) {
        console.log('AI Companion initialized for user:', user?.email);
      }
  }

  public setOnSpeechStart(callback: () => void) { this.onSpeechStartCallback = callback; }
  public setOnSpeechEnd(callback: () => void) { this.onSpeechEndCallback = callback; }
  public setOnProcessingStart(callback: () => void) { this.onProcessingStartCallback = callback; }
  public setOnProcessingEnd(callback: () => void) { this.onProcessingEndCallback = callback; }

  // This is the new core logic that gets triggered by the live transcript
  private async onTranscriptUpdate(transcript: { text: string; final: boolean }): Promise<void> {
    if (!transcript.final || !transcript.text) return;

    console.log('Final User Transcript:', transcript.text);
    
    this.onProcessingStartCallback?.();
    
    try {
      // Since we don't have a final audio blob, we'll skip emotion detection for this stream.
      // A more advanced implementation could analyze audio chunks, but this is a good start.
      const fakeEmotionResult = { description: "Streaming audio, emotion not analyzed." };

      await this.processAndRespond(transcript.text, fakeEmotionResult.description);
    } catch (error) {
      console.error('Error processing transcript:', error);
    } finally {
      this.onProcessingEndCallback?.();
    }
  }
  
  private async processAndRespond(transcribedText: string, featureDescription: string): Promise<void> {
      const startTime = Date.now();
      const recentInteractions = await this.getRecentInteractions();
      
      const responseStream = this.responseGenerator.generateResponseStream(
        transcribedText, 
        featureDescription, 
        recentInteractions
      );

      let fullAIResponse = "";
      let finalMood: string | null = null;

      for await (const result of responseStream) {
          if (result.isFinal) {
              fullAIResponse = result.fullResponse;
              finalMood = result.mood;
          }
      }
      
      if (fullAIResponse) {
        console.log('AI response:', fullAIResponse);
        await this.ttsEngine.speakText(fullAIResponse);
        console.log('AI finished speaking.');

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
        console.warn('LLM generated no response.');
      }
  }

  public async startCall(): Promise<void> {
    if (this.isCallActive) return;
    this.isCallActive = true;
    console.log('Call started.');
    // Use the new streaming method
    await this.audioProcessor.startContinuousStreaming(
      this.onTranscriptUpdate.bind(this),
      () => this.onSpeechStartCallback?.(),
      { assemblyai_api_key: this.configManager.get('assemblyai_api_key') }
    );
  }

  public stopCall(): void {
    if (!this.isCallActive) return;
    this.isCallActive = false;
    console.log('Call ended.');
    this.audioProcessor.stopContinuousStreaming();
  }

  private async saveInteraction(interaction: Interaction): Promise<void> {
    if (!this.currentUserId) return;
    await supabase.from('interactions').insert([{
        user_id: this.currentUserId,
        timestamp: interaction.timestamp,
        user_input: interaction.user_input,
        ai_response: interaction.ai_response,
        feature_description: interaction.feature_description,
        response_time: interaction.response_time,
        user_mood: interaction.user_mood,
    }]);
  }

  private async getRecentInteractions(limit: number = 5): Promise<DatabaseInteraction[]> {
      if (!this.currentUserId) return [];
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
  }
}