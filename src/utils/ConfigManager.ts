import { Config } from '../types';

export class ConfigManager {
  private config: Config;
  private readonly configKey = 'emotional-ai-config';

  constructor() {
    this.config = {
      voice_id: "21m00Tcm4TlvDq8ikWAM",
      silence_threshold: 0.01,
      max_duration: 10,
      transcription_method: "openai"
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
      // Exclude API keys from localStorage
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
}