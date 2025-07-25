import { AudioProcessor } from './AudioProcessor';
import { EmotionDetector } from './EmotionDetector';
import { ResponseGenerator } from './ResponseGenerator';
import { TextToSpeechEngine } from './TextToSpeechEngine';
import { ConfigManager } from './ConfigManager';
import { Interaction } from '../types';

export class EmotionalAICompanion {
  private audioProcessor: AudioProcessor;
  private emotionDetector: EmotionDetector;
  private responseGenerator: ResponseGenerator;
  private ttsEngine: TextToSpeechEngine;
  private configManager: ConfigManager;
  private conversationLog: Interaction[] = [];

  constructor(openrouterApiKey: string, configManager: ConfigManager) {
    this.configManager = configManager;
    this.audioProcessor = new AudioProcessor();
    this.emotionDetector = new EmotionDetector();
    this.responseGenerator = new ResponseGenerator(openrouterApiKey);
    this.ttsEngine = new TextToSpeechEngine(
      configManager.get('eleven_labs_api_key'),
      configManager.get('voice_id') || "21m00Tcm4TlvDq8ikWAM"
    );
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
      
      // Extract emotion features
      const emotionResult = await this.emotionDetector.detectEmotion(audioBlob);
      const features = emotionResult.features;

      // Calculate speaking rate if we have transcription
      if (transcribedText && features.duration && features.duration > 0) {
        const numWords = transcribedText.split(' ').length;
        const speakingRate = (numWords / features.duration) * 60;
        features.speaking_rate = speakingRate;
      }

      const description = emotionResult.description;
      const userInput = transcribedText || "Audio input processed";

      // Generate AI response
      const responseText = await this.responseGenerator.generateResponse(userInput, description);
      
      if (responseText) {
        console.log(`Generated response: ${responseText}`);
        // Speak the response
        await this.ttsEngine.speakText(responseText);
      } else {
        console.warn('No response text generated, skipping TTS');
        throw new Error('No response text generated');
      }

      // Create interaction record
      const interaction: Interaction = {
        timestamp: new Date().toISOString(),
        user_input: userInput,
        feature_description: description,
        ai_response: responseText,
        response_time: (Date.now() - startTime) / 1000
      };

      this.conversationLog.push(interaction);
      console.log(`Interaction logged - Response time: ${interaction.response_time.toFixed(2)}s`);
      
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
}