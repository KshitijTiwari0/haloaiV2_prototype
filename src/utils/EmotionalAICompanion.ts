import { AudioProcessor } from './AudioProcessor';
import { EmotionDetector } from './EmotionDetector';
import { ResponseGenerator } from './ResponseGenerator';
import { TextToSpeechEngine } from './TextToSpeechEngine';
import { ConfigManager, SupportedLanguage } from './ConfigManager';
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
  private currentLanguage: SupportedLanguage = 'auto';
  
  // Callback functions
  private onSpeechStartCallback: (() => void) | null = null;
  private onSpeechEndCallback: (() => void) | null = null;
  private onProcessingStartCallback: (() => void) | null = null;
  private onProcessingEndCallback: (() => void) | null = null;
  private onAISpeakingStartCallback: (() => void) | null = null;
  private onAISpeakingEndCallback: (() => void) | null = null;
  private onLanguageDetectedCallback: ((language: string) => void) | null = null;

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

    // Get current language setting
    this.currentLanguage = this.configManager.getCurrentLanguage();

    // Initialize components
    this.audioProcessor = new AudioProcessor();
    this.emotionDetector = new EmotionDetector();
    this.responseGenerator = new ResponseGenerator(openaiApiKey);
    this.ttsEngine = new TextToSpeechEngine(
      elevenLabsApiKey,
      configManager.get('voice_id') || configManager.getVoiceForLanguage(this.currentLanguage)
    );
    
    // Set initial language in audio processor
    this.audioProcessor.setLanguage(this.currentLanguage);
    
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
    
    console.log(`EmotionalAICompanion initialized with OpenAI + Eleven Labs (Language: ${this.currentLanguage})`);
  }

  private async initializeUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      this.currentUserId = user?.id || null;
      if (this.currentUserId) {
        console.log('AI Companion initialized for user:', user?.email);
        
        // Load user's language preference from database
        await this.loadUserLanguagePreference();
        
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

  // Load user's language preference from database
  private async loadUserLanguagePreference(): Promise<void> {
    if (!this.currentUserId) return;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('language_preference')
        .eq('user_id', this.currentUserId)
        .single();

      if (data?.language_preference && !error) {
        const savedLanguage = data.language_preference as SupportedLanguage;
        this.setLanguage(savedLanguage);
        console.log(`Loaded user language preference: ${savedLanguage}`);
      }
    } catch (error) {
      console.error('Error loading user language preference:', error);
    }
  }

  // Save user's language preference to database
  private async saveUserLanguagePreference(language: SupportedLanguage): Promise<void> {
    if (!this.currentUserId) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: this.currentUserId,
          language_preference: language,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error saving language preference:', error);
      } else {
        console.log(`Saved language preference: ${language}`);
      }
    } catch (error) {
      console.error('Exception saving language preference:', error);
    }
  }

  // Set language for the entire system
  public setLanguage(language: SupportedLanguage): void {
    this.currentLanguage = language;
    
    // Update all components
    this.configManager.setLanguage(language);
    this.audioProcessor.setLanguage(language);
    
    // Update voice for TTS
    const voiceId = this.configManager.getVoiceForLanguage(language);
    this.ttsEngine.setVoiceId(voiceId);
    
    // Save to database
    this.saveUserLanguagePreference(language);
    
    console.log(`Language changed to: ${language}, Voice: ${voiceId}`);
  }

  // Get current language
  public getCurrentLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }

  // Get supported languages
  public getSupportedLanguages(): { code: SupportedLanguage; name: string; rtl: boolean }[] {
    return this.configManager.getSupportedLanguages();
  }

  // Existing callback setters
  public setOnSpeechStart(callback: () => void) { this.onSpeechStartCallback = callback; }
  public setOnSpeechEnd(callback: () => void) { this.onSpeechEndCallback = callback; }
  public setOnProcessingStart(callback: () => void) { this.onProcessingStartCallback = callback; }
  public setOnProcessingEnd(callback: () => void) { this.onProcessingEndCallback = callback; }
  public setOnAISpeakingStart(callback: () => void) { this.onAISpeakingStartCallback = callback; }
  public setOnAISpeakingEnd(callback: () => void) { this.onAISpeakingEndCallback = callback; }
  
  // New callback for language detection
  public setOnLanguageDetected(callback: (language: string) => void) { this.onLanguageDetectedCallback = callback; }

  private async onTranscriptUpdate(transcript: { text: string; final: boolean; language?: string }): Promise<void> {
    if (!transcript.final || !transcript.text.trim()) return;
    
    console.log('Final User Transcript:', {
      text: transcript.text,
      detectedLanguage: transcript.language,
      currentLanguage: this.currentLanguage
    });

    // Handle language detection and auto-switching
    if (transcript.language && transcript.language !== this.currentLanguage) {
      if (this.currentLanguage === 'auto') {
        // Auto-switch to detected language
        this.setLanguage(transcript.language as SupportedLanguage);
        this.onLanguageDetectedCallback?.(transcript.language);
        console.log(`Auto-switched to detected language: ${transcript.language}`);
      } else {
        // Notify about detected language but don't switch
        this.onLanguageDetectedCallback?.(transcript.language);
        console.log(`Detected language (${transcript.language}) differs from current (${this.currentLanguage})`);
      }
    }

    this.onSpeechEndCallback?.(); // User finished speaking
    this.onProcessingStartCallback?.(); // Start processing
    
    try {
      // Generate feature description from text (enhanced for multilingual)
      const featureDescription = this.generateFeatureDescriptionFromText(transcript.text, transcript.language);
      
      await this.processAndRespond(transcript.text, featureDescription, transcript.language);
    } catch (error) {
      console.error('Error processing transcript:', error);
      
      // Provide fallback response in appropriate language
      try {
        const fallbackText = this.getFallbackText('processing_error');
        await this.ttsEngine.speakText(fallbackText, true, transcript.language);
      } catch (ttsError) {
        console.error('Error with fallback TTS:', ttsError);
      }
    } finally {
      this.onProcessingEndCallback?.();
    }
  }

  private generateFeatureDescriptionFromText(text: string, detectedLanguage?: string): string {
    // Enhanced text analysis with language awareness
    const wordCount = text.split(' ').length;
    const hasQuestionMarks = text.includes('?') || text.includes('؟'); // Arabic question mark
    const hasExclamations = text.includes('!');
    const allCaps = text === text.toUpperCase() && text.length > 5;
    
    // Language-specific patterns
    const arabicPattern = /[\u0600-\u06FF]/;
    const hindiPattern = /[\u0900-\u097F]/;
    
    let description = `Text analysis: ${wordCount} words`;
    
    if (detectedLanguage) {
      description += `, detected language: ${detectedLanguage}`;
    }
    
    if (arabicPattern.test(text)) {
      description += ", Arabic script detected";
    } else if (hindiPattern.test(text)) {
      description += ", Devanagari script detected";
    }
    
    if (hasQuestionMarks) description += ", questioning tone";
    if (hasExclamations) description += ", excited/emphatic tone";
    if (allCaps) description += ", emphasized/loud tone";
    if (wordCount < 3) description += ", brief response";
    if (wordCount > 20) description += ", lengthy response";
    
    return description;
  }

  private getFallbackText(type: 'processing_error' | 'understanding_error'): string {
    const fallbacks = {
      'processing_error': {
        'en': "I'm having trouble understanding. Could you please try again?",
        'hi': "मुझे समझने में परेशानी हो रही है। क्या आप फिर से कोशिश कर सकते हैं?",
        'ar': "أواجه صعوبة في الفهم. هل يمكنك المحاولة مرة أخرى؟"
      },
      'understanding_error': {
        'en': "I'm not sure how to respond to that. Could you tell me more?",
        'hi': "मुझे यकीन नहीं है कि इसका जवाब कैसे दूं। क्या आप मुझे और बता सकते हैं?",
        'ar': "لست متأكدا من كيفية الرد على ذلك. هل يمكنك إخباري المزيد؟"
      }
    };
    
    const languageKey = this.currentLanguage === 'auto' ? 'en' : this.currentLanguage;
    return fallbacks[type][languageKey as keyof typeof fallbacks[typeof type]] || fallbacks[type]['en'];
  }
  
  private async processAndRespond(transcribedText: string, featureDescription: string, detectedLanguage?: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Get recent conversation history
      const recentInteractions = await this.getRecentInteractions();
      
      // Determine response language
      const responseLanguage = detectedLanguage || this.currentLanguage;
      
      // Generate response using streaming with language context
      const responseStream = this.responseGenerator.generateResponseStream(
        transcribedText, 
        featureDescription, 
        recentInteractions,
        {},
        responseLanguage as SupportedLanguage
      );

      let fullAIResponse = "";
      let finalMood: string | null = null;
      let finalLanguage: string | null = null;

      // Process streaming response
      for await (const result of responseStream) {
        if (result.isFinal) {
          fullAIResponse = result.fullResponse;
          finalMood = result.mood;
          finalLanguage = result.language;
        }
      }
      
      if (fullAIResponse && fullAIResponse.trim()) {
        console.log('AI response:', {
          text: fullAIResponse,
          mood: finalMood,
          language: finalLanguage
        });
        
        // Speak the response with appropriate voice
        await this.ttsEngine.speakText(fullAIResponse, true, finalLanguage || detectedLanguage);
        console.log('AI finished speaking');

        // Save interaction to database with language information
        const interaction: Interaction = {
          timestamp: new Date().toISOString(),
          user_input: transcribedText,
          feature_description: featureDescription,
          ai_response: fullAIResponse,
          response_time: (Date.now() - startTime) / 1000,
          user_mood: finalMood || 'neutral',
          language: finalLanguage || detectedLanguage || this.currentLanguage
        };
        
        await this.saveInteraction(interaction);
      } else {
        console.warn('No response generated from AI');
        // Provide fallback response
        const fallbackText = this.getFallbackText('understanding_error');
        await this.ttsEngine.speakText(fallbackText, true, detectedLanguage);
      }
      
    } catch (error) {
      console.error('Error in processAndRespond:', error);
      
      // Provide error fallback
      try {
        const fallbackText = this.getFallbackText('processing_error');
        await this.ttsEngine.speakText(fallbackText, true, detectedLanguage);
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
      console.log(`Starting call with language: ${this.currentLanguage}...`);
      
      // Start audio processing with current language setting
      await this.audioProcessor.startContinuousStreaming(
        this.onTranscriptUpdate.bind(this),
        () => this.onSpeechStartCallback?.(),
        this.currentLanguage
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
        language_used: interaction.language, // Store the language used
      }]);

      if (error) {
        console.error('Error saving interaction:', error);
      } else {
        console.log('Interaction saved successfully with language:', interaction.language);
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
    return {
      ...this.configManager.getConfigSummary(),
      currentLanguage: this.currentLanguage,
      isRTL: this.configManager.isRTL()
    };
  }

  // Voice management with language support
  public async getAvailableVoices(): Promise<any[]> {
    return await this.ttsEngine.getAvailableVoices();
  }

  public setVoice(voiceId: string): void {
    this.ttsEngine.setVoiceId(voiceId);
    this.configManager.set('voice_id', voiceId);
  }

  public setVoiceForLanguage(language: SupportedLanguage, voiceId: string): void {
    this.ttsEngine.setVoiceForLanguage(language, voiceId);
    this.configManager.set('voice_mapping', {
      ...this.configManager.get('voice_mapping'),
      [language]: voiceId
    });
  }

  public getCurrentVoiceId(): string {
    return this.ttsEngine.getVoiceId();
  }

  public getVoiceMappings(): Record<string, string> {
    return this.ttsEngine.getVoiceMappings();
  }

  // Test voice for specific language
  public async testVoice(language: SupportedLanguage): Promise<void> {
    await this.ttsEngine.testVoice(language);
  }

  // Check if current language uses RTL
  public isRTL(): boolean {
    return this.configManager.isRTL();
  }

  // Get language display name
  public getLanguageDisplayName(language: SupportedLanguage): string {
    return this.configManager.getLanguageDisplayName(language);
  }
}