import { Config } from '../types';

export class ConfigManager {
  private config: Config;
  private readonly configKey = 'emotional-ai-config';

  constructor() {
    this.config = {
      voice_id: "21m00Tcm4TlvDq8ikWAM", // Default Eleven Labs voice
      silence_threshold: 0.01,
      max_duration: 30, // Increased for Whisper
      transcription_method: "whisper" // Only Whisper now
    };
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      const stored = localStorage.getItem(this.configKey);
      if (stored) {
        const parsedConfig = JSON.parse(stored);
        this.config = { ...this.config, ...parsedConfig };
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
    this.saveConfig();
  }

  getAll(): Config {
    return { ...this.config };
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
      has_openai_key: !!this.config.openai_api_key,
      has_eleven_labs_key: !!this.config.eleven_labs_api_key
    };
  }

  // Reset to defaults (excluding API keys)
  resetToDefaults(): void {
    const apiKeys = {
      openai_api_key: this.config.openai_api_key,
      eleven_labs_api_key: this.config.eleven_labs_api_key
    };

    this.config = {
      voice_id: "21m00Tcm4TlvDq8ikWAM",
      silence_threshold: 0.01,
      max_duration: 30,
      transcription_method: "whisper",
      ...apiKeys
    };

    this.saveConfig();
    console.log('Configuration reset to defaults');
  }
}