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

  private async onUtteranceEnd(audioBlob: Blob): Promise<void> {
    this.onProcessingStartCallback?.();
    this.audioProcessor.setAITalking(true);

    try {
      const transcribedText = await this.transcribeAudio(audioBlob);
      if (!transcribedText) {
        console.warn('Transcription failed or produced no text.');
        return;
      }
      console.log('User said:', transcribedText);

      await this.processAndRespond(audioBlob, transcribedText);
      
    } catch (error) {
      console.error('Error processing utterance:', error);
    } finally {
      this.audioProcessor.setAITalking(false);
      this.onProcessingEndCallback?.();
      console.log('--- Ready for next user input ---');
    }
  }
  
  private async processAndRespond(audioBlob: Blob, transcribedText: string): Promise<void> {
      const startTime = Date.now();
      const emotionResult = await this.emotionDetector.detectEmotion(audioBlob);
      const recentInteractions = await this.getRecentInteractions();
      
      const llmResponse = await this.responseGenerator.generateResponse(
        transcribedText, 
        emotionResult.description, 
        recentInteractions
      );
      
      if (llmResponse.ai_response) {
        console.log('AI will say:', llmResponse.ai_response);
        
        await this.ttsEngine.speakText(llmResponse.ai_response);
        console.log('AI finished speaking.');

        const interaction: Interaction = {
            timestamp: new Date().toISOString(),
            user_input: transcribedText,
            feature_description: emotionResult.description,
            ai_response: llmResponse.ai_response,
            response_time: (Date.now() - startTime) / 1000,
            user_mood: llmResponse.user_mood
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
    await this.audioProcessor.startContinuousRecording(
      this.onUtteranceEnd.bind(this),
      () => this.onSpeechStartCallback?.(),
      () => this.onSpeechEndCallback?.()
    );
  }

  public stopCall(): void {
    if (!this.isCallActive) return;
    this.isCallActive = false;
    console.log('Call ended.');
    this.audioProcessor.stopContinuousRecording();
  }
  
  private async transcribeAudio(audioBlob: Blob): Promise<string | null> {
    const config = {
      assemblyai_api_key: this.configManager.get('assemblyai_api_key'),
    };
    return await this.audioProcessor.transcribeAudio(audioBlob, config);
  }

  private async saveInteraction(interaction: Interaction): Promise<void> {
    if (!this.currentUserId) return;
    await supabase.from('interactions').insert({
        user_id: this.currentUserId,
        ...interaction
    });
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