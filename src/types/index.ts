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
  language?: string; // Added for multi-language support
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
  language_used: string | null; // Added for multi-language support
}

export interface UserProfile {
  id: string;
  user_id: string;
  preferences: Record<string, any>;
  language_preference: string; // Added for multi-language support
  created_at: string;
  updated_at: string;
}

// Multi-language support types
export type SupportedLanguage = 'en' | 'hi' | 'ar' | 'auto';

export interface LanguageConfig {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  rtl: boolean;
  voiceId: string;
}

// Updated configuration with multi-language support
export interface Config {
  voice_id: string;
  silence_threshold: number;
  max_duration: number;
  transcription_method: string;
  language: SupportedLanguage; // Added
  voice_mapping: Record<string, string>; // Added
  rtl_support: boolean; // Added
  openai_api_key?: string;
  eleven_labs_api_key?: string;
}

// OpenAI API types
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIStreamChunk {
  choices: Array<{
    delta: {
      content?: string;
      role?: string;
    };
    finish_reason?: string;
    index: number;
  }>;
  created: number;
  id: string;
  model: string;
  object: string;
}

export interface OpenAIResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
    index: number;
  }>;
  created: number;
  id: string;
  model: string;
  object: string;
  usage: {
    completion_tokens: number;
    prompt_tokens: number;
    total_tokens: number;
  };
}

// Whisper API types with language support
export interface WhisperResponse {
  text: string;
  language?: string; // Added - detected language
}

export interface WhisperRequest {
  file: File;
  model: string;
  language?: string; // Added - can specify language or 'auto'
  response_format?: string;
  temperature?: number;
}

// Eleven Labs API types
export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  samples: Array<{
    sample_id: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    hash: string;
  }>;
  category: string;
  fine_tuning: {
    model_id: string | null;
    is_allowed_to_fine_tune: boolean;
    finetuning_requested: boolean;
    finetuning_state: string;
    verification_attempts: Array<any>;
    verification_failures: Array<string>;
    verification_attempts_count: number;
    slice_ids: Array<string> | null;
  };
  labels: Record<string, string>;
  description: string;
  preview_url: string;
  available_for_tiers: Array<string>;
  settings: {
    stability: number;
    similarity_boost: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
  sharing: {
    status: string;
    history_item_sample_id: string | null;
    original_voice_id: string | null;
    public_owner_id: string | null;
    liked_by_count: number;
    cloned_by_count: number;
    name: string;
    description: string;
    labels: Record<string, string>;
    enabled_in_library: boolean;
  };
  high_quality_base_model_ids: Array<string>;
}

export interface ElevenLabsVoicesResponse {
  voices: ElevenLabsVoice[];
}

// Error types
export interface APIError {
  error: string;
  details?: string;
  status?: number;
}

// Validation types
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  missing?: string[];
}

// Configuration validation
export interface ConfigValidation {
  valid: boolean;
  missing: string[];
}

// Audio processing types
export interface AudioChunk {
  data: Blob;
  timestamp: number;
  duration: number;
}

export interface TranscriptionResult {
  text: string;
  final: boolean;
  confidence?: number;
  language?: string; // Added for detected language
}

// Component prop types
export interface AICompanionSetupResult {
  companion: any; // EmotionalAICompanion instance
  error: string | null;
}

// Mood types - standardized list
export type UserMood = 
  | 'excited'
  | 'happy' 
  | 'sad'
  | 'stressed'
  | 'calm'
  | 'neutral'
  | 'frustrated'
  | 'tired'
  | 'contemplative'
  | 'confident';

// Response streaming types with language
export interface ResponseStreamChunk {
  chunk: string;
  isFinal: boolean;
  fullResponse: string;
  mood: string | null;
  language?: string; // Added
}

// Netlify function types
export interface NetlifyFunctionResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded?: boolean;
}

export interface TranscribeAudioRequest {
  audio: File;
  model: string;
  language?: string; // Added - can be specific language or 'auto'
  response_format?: string;
  temperature?: number;
}

export interface ChatCompletionRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  language?: string; // Added for language context
}

export interface OnboardingStep {
  target: string;
  content: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
}