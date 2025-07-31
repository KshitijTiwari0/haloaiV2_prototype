export interface AudioFeatures {
  duration: number;
  pitch_mean: number;
  pitch_std: number;
  pitch_skew: number;
  pitch_kurtosis: number;
  energy_mean: number;
  energy_std: number;
  energy_skew: number;
  energy_kurtosis: number;
  silence_ratio: number;
  tempo: number;
  chroma_mean: number;
  chroma_std: number;
  spectral_centroid_mean: number;
  spectral_centroid_std: number;
  spectral_bandwidth_mean: number;
  spectral_bandwidth_std: number;
  spectral_flatness_mean: number;
  spectral_flatness_std: number;
  spectral_rolloff_mean: number;
  spectral_rolloff_std: number;
  zcr_mean: number;
  zcr_std: number;
  ste_mean: number;
  ste_std: number;
  speaking_rate?: number;
  [key: string]: number | undefined;
}

export interface EmotionResult {
  features: AudioFeatures;
  description: string;
}

export interface Interaction {
  timestamp: string;
  user_input: string;
  feature_description: string;
  ai_response: string;
  response_time: number;
  user_mood?: string;
}

export interface LLMResponse {
  ai_response: string;
  user_mood: string;
}

export interface DatabaseInteraction {
  id: string;
  user_id: string;
  timestamp: string;
  user_input: string;
  ai_response: string;
  feature_description: string | null;
  response_time: number;
  created_at: string;
  user_mood: string | null;
}

export interface UserProfile {
  id: string;
  user_id: string;
  preferences: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Config {
  voice_id: string;
  silence_threshold: number;
  max_duration: number;
  transcription_method: string;
  openrouter_api_key?: string;
  eleven_labs_api_key?: string;
  openai_api_key?: string;
  assemblyai_api_key?: string;
}