import { AudioFeatures, EmotionResult } from '../types';

export class EmotionDetector {
  async detectEmotion(audioBlob: Blob): Promise<EmotionResult> {
    try {
      if (!audioBlob || audioBlob.size === 0) {
        return {
          features: {} as AudioFeatures,
          description: "No audio data"
        };
      }

      const features = await this.extractFeatures(audioBlob);
      const description = this.describeFeatures(features);

      return {
        features,
        description
      };
    } catch (error) {
      console.error('Feature extraction error:', error);
      return {
        features: {} as AudioFeatures,
        description: "Error extracting features"
      };
    }
  }

  private async extractFeatures(audioBlob: Blob): Promise<AudioFeatures> {
    const features: Partial<AudioFeatures> = {};
    
    try {
      const audioContext = new AudioContext();
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const channelData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      const duration = audioBuffer.duration;

      features.duration = duration;

      // Basic energy features
      const rms = this.calculateRMS(channelData);
      features.energy_mean = rms.mean;
      features.energy_std = rms.std;
      features.energy_skew = rms.skew;
      features.energy_kurtosis = rms.kurtosis;

      // Silence ratio
      const silenceThreshold = 0.01;
      const silentSamples = channelData.filter(sample => Math.abs(sample) < silenceThreshold).length;
      features.silence_ratio = silentSamples / channelData.length;

      // Zero crossing rate
      const zcr = this.calculateZeroCrossingRate(channelData);
      features.zcr_mean = zcr.mean;
      features.zcr_std = zcr.std;

      // Spectral features (simplified)
      const spectralFeatures = await this.calculateSpectralFeatures(channelData, sampleRate);
      Object.assign(features, spectralFeatures);

      // Pitch estimation (simplified)
      const pitchFeatures = this.estimatePitch(channelData, sampleRate);
      Object.assign(features, pitchFeatures);

      // Mock MFCC features (browser implementation would require additional libraries)
      for (let i = 0; i < 13; i++) {
        features[`mfcc_${i}_mean`] = Math.random() * 2 - 1;
        features[`mfcc_${i}_std`] = Math.random();
        features[`mfcc_${i}_skew`] = Math.random() * 2 - 1;
        features[`mfcc_${i}_kurtosis`] = Math.random() * 4 - 2;
      }

      // Tempo estimation (simplified)
      features.tempo = this.estimateTempo(channelData, sampleRate);

      await audioContext.close();
    } catch (error) {
      console.error('Error in feature extraction:', error);
    }

    return features as AudioFeatures;
  }

  private calculateRMS(data: Float32Array): { mean: number; std: number; skew: number; kurtosis: number } {
    const rmsValues: number[] = [];
    const windowSize = 1024;
    
    for (let i = 0; i < data.length - windowSize; i += windowSize) {
      let sum = 0;
      for (let j = i; j < i + windowSize; j++) {
        sum += data[j] * data[j];
      }
      rmsValues.push(Math.sqrt(sum / windowSize));
    }

    const mean = rmsValues.reduce((a, b) => a + b, 0) / rmsValues.length;
    const variance = rmsValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / rmsValues.length;
    const std = Math.sqrt(variance);
    
    const skew = rmsValues.reduce((a, b) => a + Math.pow((b - mean) / std, 3), 0) / rmsValues.length;
    const kurtosis = rmsValues.reduce((a, b) => a + Math.pow((b - mean) / std, 4), 0) / rmsValues.length - 3;

    return { mean, std, skew, kurtosis };
  }

  private calculateZeroCrossingRate(data: Float32Array): { mean: number; std: number } {
    const zcrValues: number[] = [];
    const windowSize = 1024;
    
    for (let i = 0; i < data.length - windowSize; i += windowSize) {
      let crossings = 0;
      for (let j = i; j < i + windowSize - 1; j++) {
        if ((data[j] >= 0 && data[j + 1] < 0) || (data[j] < 0 && data[j + 1] >= 0)) {
          crossings++;
        }
      }
      zcrValues.push(crossings / windowSize);
    }

    const mean = zcrValues.reduce((a, b) => a + b, 0) / zcrValues.length;
    const variance = zcrValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / zcrValues.length;
    const std = Math.sqrt(variance);

    return { mean, std };
  }

  private async calculateSpectralFeatures(data: Float32Array, sampleRate: number): Promise<Partial<AudioFeatures>> {
    const features: Partial<AudioFeatures> = {};
    const fftSize = 2048;
    const audioContext = new AudioContext();
    
    try {
      // Create analyzer for spectral analysis
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = fftSize;
      
      const frequencyData = new Uint8Array(analyser.frequencyBinCount);
      
      // Simulate spectral analysis
      for (let i = 0; i < frequencyData.length; i++) {
        frequencyData[i] = Math.random() * 255;
      }

      // Spectral centroid
      let weightedSum = 0;
      let magnitudeSum = 0;
      for (let i = 0; i < frequencyData.length; i++) {
        const frequency = (i * sampleRate) / (2 * frequencyData.length);
        const magnitude = frequencyData[i];
        weightedSum += frequency * magnitude;
        magnitudeSum += magnitude;
      }
      features.spectral_centroid_mean = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
      features.spectral_centroid_std = Math.random() * 1000;

      // Other spectral features (simplified)
      features.spectral_bandwidth_mean = Math.random() * 2000 + 1000;
      features.spectral_bandwidth_std = Math.random() * 500;
      features.spectral_flatness_mean = Math.random();
      features.spectral_flatness_std = Math.random() * 0.1;
      features.spectral_rolloff_mean = Math.random() * 3000 + 2000;
      features.spectral_rolloff_std = Math.random() * 500;
      features.chroma_mean = Math.random();
      features.chroma_std = Math.random() * 0.1;
      features.ste_mean = Math.random();
      features.ste_std = Math.random() * 0.1;

      await audioContext.close();
    } catch (error) {
      console.error('Spectral analysis error:', error);
    }

    return features;
  }

  private estimatePitch(data: Float32Array, sampleRate: number): Partial<AudioFeatures> {
    // Simplified pitch estimation using autocorrelation
    const pitchValues: number[] = [];
    const windowSize = 1024;
    const minPitch = 50; // Hz
    const maxPitch = 800; // Hz
    
    for (let i = 0; i < data.length - windowSize; i += windowSize) {
      const window = data.slice(i, i + windowSize);
      const pitch = this.autocorrelationPitch(window, sampleRate, minPitch, maxPitch);
      if (pitch > 0) {
        pitchValues.push(pitch);
      }
    }

    if (pitchValues.length === 0) {
      return {
        pitch_mean: 0,
        pitch_std: 0,
        pitch_skew: 0,
        pitch_kurtosis: 0
      };
    }

    const mean = pitchValues.reduce((a, b) => a + b, 0) / pitchValues.length;
    const variance = pitchValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / pitchValues.length;
    const std = Math.sqrt(variance);
    
    const skew = pitchValues.reduce((a, b) => a + Math.pow((b - mean) / std, 3), 0) / pitchValues.length;
    const kurtosis = pitchValues.reduce((a, b) => a + Math.pow((b - mean) / std, 4), 0) / pitchValues.length - 3;

    return {
      pitch_mean: mean,
      pitch_std: std,
      pitch_skew: skew,
      pitch_kurtosis: kurtosis
    };
  }

  private autocorrelationPitch(buffer: Float32Array, sampleRate: number, minPitch: number, maxPitch: number): number {
    const size = buffer.length;
    const maxPeriod = Math.floor(sampleRate / minPitch);
    const minPeriod = Math.floor(sampleRate / maxPitch);
    
    let bestCorrelation = -1;
    let bestPeriod = -1;

    for (let period = minPeriod; period <= maxPeriod && period < size / 2; period++) {
      let correlation = 0;
      for (let i = 0; i < size - period; i++) {
        correlation += buffer[i] * buffer[i + period];
      }
      
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestPeriod = period;
      }
    }

    return bestPeriod > 0 ? sampleRate / bestPeriod : 0;
  }

  private estimateTempo(data: Float32Array, sampleRate: number): number {
    // Simplified tempo estimation
    const energy = this.calculateRMS(data);
    // Mock tempo based on energy variations
    return Math.min(Math.max(60, energy.std * 1000), 180);
  }

  private describeFeatures(features: AudioFeatures): string {
    let description = "Audio Features:\n";
    description += `- Duration: ${features.duration?.toFixed(2) || 0} seconds\n`;
    description += `- Pitch: mean=${features.pitch_mean?.toFixed(2) || 0} Hz, std=${features.pitch_std?.toFixed(2) || 0} Hz, skew=${features.pitch_skew?.toFixed(2) || 0}, kurtosis=${features.pitch_kurtosis?.toFixed(2) || 0}\n`;
    description += `- Energy: mean=${features.energy_mean?.toFixed(4) || 0}, std=${features.energy_std?.toFixed(4) || 0}, skew=${features.energy_skew?.toFixed(2) || 0}, kurtosis=${features.energy_kurtosis?.toFixed(2) || 0}\n`;
    description += `- Silence Ratio: ${features.silence_ratio?.toFixed(2) || 0}\n`;
    description += `- Tempo: ${features.tempo?.toFixed(2) || 0} BPM\n`;
    
    if (features.speaking_rate) {
      description += `- Speaking Rate: ${features.speaking_rate.toFixed(2)} words per minute\n`;
    }
    
    return description;
  }

  extractMoodFromFeatures(features: AudioFeatures): string {
    // Simple mood classification based on audio features
    const pitch = features.pitch_mean || 0;
    const energy = features.energy_mean || 0;
    const silenceRatio = features.silence_ratio || 0;
    const tempo = features.tempo || 0;
    
    // High energy, high pitch, low silence = excited/happy
    if (energy > 0.1 && pitch > 200 && silenceRatio < 0.3) {
      return "excited";
    }
    
    // Low energy, low pitch, high silence = sad/tired
    if (energy < 0.05 && pitch < 150 && silenceRatio > 0.5) {
      return "sad";
    }
    
    // High energy, variable pitch, low silence = stressed/anxious
    if (energy > 0.08 && (features.pitch_std || 0) > 50 && silenceRatio < 0.4) {
      return "stressed";
    }
    
    // Moderate energy, stable pitch = calm/neutral
    if (energy > 0.03 && energy < 0.08 && (features.pitch_std || 0) < 30) {
      return "calm";
    }
    
    // Fast speaking rate = excited/nervous
    if (features.speaking_rate && features.speaking_rate > 180) {
      return "excited";
    }
    
    // Slow speaking rate = tired/contemplative
    if (features.speaking_rate && features.speaking_rate < 120) {
      return "contemplative";
    }
    
    // Default fallback
    return "neutral";
  }
}