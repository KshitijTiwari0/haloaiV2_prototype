import React, { useState, useCallback, useEffect } from 'react';
import { Mic, MicOff, User as UserIcon, LogOut, Activity, Volume2, MessageSquare } from 'lucide-react';
import { AIAvatar } from './AIAvatar';
import BackgroundFX from './BackgroundFX';
import { LanguageSelector } from './LanguageSelector';
import { EmotionalAICompanion } from '../utils/EmotionalAICompanion';
import { ConfigManager, SupportedLanguage } from '../utils/ConfigManager';
import { signOut } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

interface MainPageProps {
  companion: EmotionalAICompanion;
  configManager: ConfigManager;
  user: User | null;
}

export const MainPage: React.FC<MainPageProps> = ({ companion, configManager, user }) => {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>('auto');
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const [isRTL, setIsRTL] = useState(false);

  useEffect(() => {
    const language = companion.getCurrentLanguage();
    setCurrentLanguage(language);
    setIsRTL(companion.isRTL());
  }, [companion]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleLanguageChange = useCallback((language: SupportedLanguage) => {
    companion.setLanguage(language);
    setCurrentLanguage(language);
    setIsRTL(companion.isRTL());
    
    if (language !== 'auto') {
      setDetectedLanguage(null);
    }
    
    console.log(`Language changed to: ${language}`);
  }, [companion]);

  const handleStartCall = useCallback(async () => {
    if (isCallActive || isProcessing) return;
    try {
      setIsCallActive(true);
      setError(null);

      companion.setOnSpeechStart(() => {
        console.log('Speech started');
        setIsUserSpeaking(true);
      });
      
      companion.setOnSpeechEnd(() => {
        console.log('Speech ended');
        setIsUserSpeaking(false);
      });
      
      companion.setOnProcessingStart(() => {
        console.log('Processing started');
        setIsProcessing(true);
        setIsUserSpeaking(false);
      });
      
      companion.setOnProcessingEnd(() => {
        console.log('Processing ended');
        setIsProcessing(false);
      });

      companion.setOnAISpeakingStart(() => {
        console.log('AI speaking started');
        setIsAISpeaking(true);
        setIsProcessing(false);
      });

      companion.setOnAISpeakingEnd(() => {
        console.log('AI speaking ended');
        setIsAISpeaking(false);
      });

      companion.setOnLanguageDetected((language: string) => {
        console.log('Language detected:', language);
        setDetectedLanguage(language);
      });
      
      console.log(`Starting call with language: ${currentLanguage}...`);
      await companion.startCall();
      console.log('Call started successfully');

    } catch (err) {
      console.error('Call start error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsCallActive(false);
    }
  }, [companion, isCallActive, isProcessing, currentLanguage]);

  const handleEndCall = useCallback(() => {
    if (!isCallActive) return;
    try {
      console.log('Ending call...');
      companion.stopCall();
      setIsCallActive(false);
      setIsUserSpeaking(false);
      setIsProcessing(false);
      setIsAISpeaking(false);
      setDetectedLanguage(null);
      setError(null);
      console.log('Call ended successfully');
    } catch (err) {
      console.error('Call end error:', err);
      setError(err instanceof Error ? err.message : 'Error ending call');
    }
  }, [companion, isCallActive]);

  const getStatusMessage = () => {
    if (error) return "An error occurred. Please try again.";
    if (!isCallActive) return "Tap the mic to start speaking";
    if (isAISpeaking) return "AI is responding...";
    if (isProcessing) return "Thinking...";
    if (isUserSpeaking) return "I'm listening...";
    return "You can speak now...";
  };

  const getStatusColor = () => {
    if (error) return "text-red-400";
    if (!isCallActive) return "text-gray-400";
    if (isAISpeaking) return "text-emerald-400";
    if (isProcessing) return "text-purple-400";
    if (isUserSpeaking) return "text-pink-400";
    return "text-sky-400";
  };

  const getMicButtonClass = () => {
    let baseClass = "relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ";
    
    if (error) {
      return baseClass + "bg-red-500/20 border-2 border-red-400 text-red-400 hover:bg-red-500/30";
    }
    
    if (!isCallActive) {
      return baseClass + "bg-gradient-to-br from-blue-500/30 to-purple-500/30 border-2 border-blue-400 text-blue-400 hover:from-blue-500/40 hover:to-purple-500/40 hover:scale-105";
    }
    
    if (isAISpeaking) {
      return baseClass + "bg-gradient-to-br from-emerald-500/30 to-green-500/30 border-2 border-emerald-400 text-emerald-400 animate-pulse";
    }
    
    if (isProcessing) {
      return baseClass + "bg-gradient-to-br from-purple-500/30 to-pink-500/30 border-2 border-purple-400 text-purple-400 animate-spin";
    }
    
    if (isUserSpeaking) {
      return baseClass + "bg-gradient-to-br from-pink-500/30 to-red-500/30 border-2 border-pink-400 text-pink-400 animate-pulse scale-110";
    }
    
    return baseClass + "bg-gradient-to-br from-sky-500/30 to-blue-500/30 border-2 border-sky-400 text-sky-400 hover:scale-105";
  };

  const getActivityIndicators = () => {
    const indicators = [];
    
    if (isUserSpeaking) {
      indicators.push(
        <div key="user-speaking" className="flex items-center gap-2 px-4 py-2 rounded-full bg-pink-500/20 border border-pink-400/30">
          <Activity className="w-4 h-4 text-pink-400 animate-pulse" />
          <span className="text-pink-400 text-sm">Speaking</span>
        </div>
      );
    }
    
    if (isProcessing) {
      indicators.push(
        <div key="processing" className="flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/20 border border-purple-400/30">
          <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-purple-400 text-sm">Processing</span>
        </div>
      );
    }
    
    if (isAISpeaking) {
      indicators.push(
        <div key="ai-speaking" className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-400/30">
          <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="text-emerald-400 text-sm">AI Speaking</span>
        </div>
      );
    }
    
    return indicators;
  };

  return (
    <div className={`relative min-h-screen text-white ${isRTL ? 'rtl' : 'ltr'}`}>
      <BackgroundFX />
      
      <div className="absolute inset-0 flex flex-col items-center justify-between p-6">
        {/* Header */}
        <div className="w-full flex justify-between items-start">
          <div className="flex items-center gap-4">
            <LanguageSelector
              currentLanguage={currentLanguage}
              onLanguageChange={handleLanguageChange}
            />
            {detectedLanguage && currentLanguage === 'auto' && (
              <div className="px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30">
                <span className="text-blue-400 text-xs">Detected: {detectedLanguage}</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/10 backdrop-blur-sm">
                <UserIcon className="w-4 h-4" />
                <span className="text-sm">{user.email}</span>
              </div>
            )}
            <button
              onClick={handleSignOut}
              className="p-2 rounded-full bg-red-500/20 border border-red-400/30 text-red-400 hover:bg-red-500/30 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-col items-center gap-8">
          {/* AI Avatar */}
          <AIAvatar
            isActive={isCallActive}
            isSpeaking={isAISpeaking}
            isListening={isUserSpeaking}
            isProcessing={isProcessing}
          />

          {/* Status Message */}
          <div className="text-center">
            <h1 className={`text-2xl font-bold ${getStatusColor()} mb-2`}>
              {getStatusMessage()}
            </h1>
            {isCallActive && (
              <p className="text-gray-400 text-sm">
                Voice conversation is active
              </p>
            )}
          </div>

          {/* Activity Indicators */}
          {getActivityIndicators().length > 0 && (
            <div className="flex gap-3 flex-wrap justify-center">
              {getActivityIndicators()}
            </div>
          )}
        </div>

        {/* Bottom Controls */}
        <div className="flex flex-col items-center gap-6">
          {/* Main Mic Button */}
          <button
            onClick={isCallActive ? handleEndCall : handleStartCall}
            className={getMicButtonClass()}
            disabled={isProcessing}
            aria-label={isCallActive ? "End conversation" : "Start conversation"}
          >
            {isCallActive ? (
              <MicOff className="w-10 h-10" />
            ) : (
              <Mic className="w-10 h-10" />
            )}
            
            {/* Pulse animation for active states */}
            {(isUserSpeaking || isAISpeaking) && (
              <>
                <div className="absolute inset-0 rounded-full border-2 border-current animate-ping opacity-20"></div>
                <div className="absolute inset-0 rounded-full border-2 border-current animate-ping opacity-10 animation-delay-75"></div>
              </>
            )}
          </button>

          {/* Help Text */}
          <div className="text-center text-gray-400 text-sm max-w-md">
            {!isCallActive ? (
              <p>
                Start a voice conversation with your AI companion. 
                Choose your preferred language from the selector above.
              </p>
            ) : (
              <p>
                Speak naturally and the AI will respond. 
                Tap the microphone again to end the conversation.
              </p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-400/30 text-red-400 text-sm text-center max-w-md">
              <MessageSquare className="w-4 h-4 inline mr-2" />
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};