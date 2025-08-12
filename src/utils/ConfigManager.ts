import { Config } from '../types';

export type SupportedLanguage = 'en' | 'hi' | 'ar' | 'auto';

export class ConfigManager {
  private config: Config;
  private readonly configKey = 'emotional-ai-config';

  // Voice mapping for different languages
  private readonly voiceMapping = {
    'en': 's3TPKV1kjDlVtZbl4Ksh', 
    'hi': 'jqcCZkN6Knx8BJ5TBdYR', 
    'ar': 'tavIIPLplRB883FzWU0V'  
  };

  constructor() {
    this.config = {
      voice_id: this.voiceMapping.en,
      silence_threshold: 0.01,
      max_duration: 30,
      transcription_method: "whisper",
      language: 'auto' as SupportedLanguage,
      voice_mapping: this.voiceMapping,
      rtl_support: false
    };
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      const stored = localStorage.getItem(this.configKey);
      if (stored) {
        const parsedConfig = JSON.parse(stored);
        this.config = { 
          ...this.config, 
          ...parsedConfig,
          // Ensure voice mapping is always up to date
          voice_mapping: this.voiceMapping
        };
        console.log('Config loaded from localStorage');
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  }

  private saveConfig(): void {
    try {
      // Exclude API keys from localStorage for security
      const configToSave = Object.fromEntries(
        Object.entries(this.config).filter(([key]) => 
          !key.includes('api_key')
        )
      );
      localStorage.setItem(this.configKey, JSON.stringify(configToSave));
      console.log('Config saved to localStorage');
    } catch (error) {
      console.error('Error saving config:', error);
    }
  }

  get<K extends keyof Config>(key: K): Config[K] | undefined {
    return this.config[key];
  }

  set<K extends keyof Config>(key: K, value: Config[K]): void {
    this.config[key] = value;
    
    // Auto-update voice_id when language changes
    if (key === 'language' && value !== 'auto') {
      const voiceId = this.voiceMapping[value as keyof typeof this.voiceMapping];
      if (voiceId) {
        this.config.voice_id = voiceId;
        this.config.rtl_support = value === 'ar';
      }
    }
    
    this.saveConfig();
  }

  getAll(): Config {
    return { ...this.config };
  }

  // Get voice ID for specific language
  getVoiceForLanguage(language: SupportedLanguage): string {
    if (language === 'auto') {
      return this.voiceMapping.en; // Default to English
    }
    return this.voiceMapping[language] || this.voiceMapping.en;
  }

  // Set language and auto-update voice
  setLanguage(language: SupportedLanguage): void {
    this.set('language', language);
    const voiceId = this.getVoiceForLanguage(language);
    this.set('voice_id', voiceId);
    this.set('rtl_support', language === 'ar');
    console.log(`Language set to: ${language}, Voice: ${voiceId}, RTL: ${language === 'ar'}`);
  }

  // Get current language
  getCurrentLanguage(): SupportedLanguage {
    return (this.config.language as SupportedLanguage) || 'auto';
  }

  // Check if current language uses RTL
  isRTL(): boolean {
    return this.config.rtl_support || false;
  }

  // Get language display name
  getLanguageDisplayName(language: SupportedLanguage): string {
    const names = {
      'en': 'English',
      'hi': 'हिन्दी (Hindi)',
      'ar': 'العربية (Arabic)',
      'auto': 'Auto Detect'
    };
    return names[language] || 'Unknown';
  }

  // Get supported languages
  getSupportedLanguages(): { code: SupportedLanguage; name: string; rtl: boolean }[] {
    return [
      { code: 'auto', name: 'Auto Detect', rtl: false },
      { code: 'en', name: 'English', rtl: false },
      { code: 'hi', name: 'हिन्दी (Hindi)', rtl: false },
      { code: 'ar', name: 'العربية (Arabic)', rtl: true }
    ];
  }

  // Helper method to validate required API keys
  validateConfiguration(): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    
    if (!this.config.openai_api_key) {
      missing.push('OpenAI API Key');
    }
    
    if (!this.config.eleven_labs_api_key) {
      missing.push('Eleven Labs API Key');
    }

    return {
      valid: missing.length === 0,
      missing
    };
  }

  // Get configuration summary for debugging
  getConfigSummary(): Record<string, any> {
    return {
      voice_id: this.config.voice_id,
      max_duration: this.config.max_duration,
      silence_threshold: this.config.silence_threshold,
      transcription_method: this.config.transcription_method,
      language: this.config.language,
      rtl_support: this.config.rtl_support,
      has_openai_key: !!this.config.openai_api_key,
      has_eleven_labs_key: !!this.config.eleven_labs_api_key,
      voice_mapping: this.config.voice_mapping
    };
  }

  // Reset to defaults (excluding API keys)
  resetToDefaults(): void {
    const apiKeys = {
      openai_api_key: this.config.openai_api_key,
      eleven_labs_api_key: this.config.eleven_labs_api_key
    };

    this.config = {
      voice_id: this.voiceMapping.en,
      silence_threshold: 0.01,
      max_duration: 30,
      transcription_method: "whisper",
      language: 'auto' as SupportedLanguage,
      voice_mapping: this.voiceMapping,
      rtl_support: false,
      ...apiKeys
    };

    this.saveConfig();
    console.log('Configuration reset to defaults');
  }
}