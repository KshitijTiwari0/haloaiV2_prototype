import React, { useState, useCallback, useEffect } from 'react';
import { Mic, MicOff, User as UserIcon, LogOut, Activity, Volume2, MessageSquare, X } from 'lucide-react';
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
  const [showDisclaimer, setShowDisclaimer] = useState(true);

  // Initialize language state from companion
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
    
    // Clear detected language if switching to a specific language
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

      // Setup UI callbacks for avatar state
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
        setIsUserSpeaking(false); // Stop user speaking when processing starts
      });
      
      companion.setOnProcessingEnd(() => {
        console.log('Processing ended');
        setIsProcessing(false);
      });

      // Setup AI speaking callbacks
      companion.setOnAISpeakingStart(() => {
        console.log('AI speaking started');
        setIsAISpeaking(true);
        setIsProcessing(false); // Stop processing when AI starts speaking
      });

      companion.setOnAISpeakingEnd(() => {
        console.log('AI speaking ended');
        setIsAISpeaking(false);
      });

      // Setup language detection callback
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

  // Get status message based on current state
  const getStatusMessage = () => {
    if (error) return "An error occurred. Please try again.";
    if (!isCallActive) return "Tap the mic to start speaking";
    if (isAISpeaking) return "AI is responding...";
    if (isProcessing) return "Thinking...";
    if (isUserSpeaking) return "I'm listening...";
    return "You can speak now...";
  };

  // Get status color based on current state
  const getStatusColor = () => {
    if (error) return "text-red-400";
    if (!isCallActive) return "text-gray-400";
    if (isAISpeaking) return "text-emerald-400";
    if (isProcessing) return "text-purple-400";
    if (isUserSpeaking) return "text-pink-400";
    return "text-sky-400";
  };

  return (
    <div className={`relative min-h-screen text-white ${isRTL ? 'rtl' : 'ltr'}`}>
      <BackgroundFX />
      <div className="absolute inset-0 flex flex-col items-center justify-between p-4 sm:p-6">
        {/* Header */}
        <div className="w-full flex justify-between items-center">
          <div className="flex items-center space-x-2 text-sm text-gray-200">
            <UserIcon size={16} />
            <span className="hidden sm:inline">{user?.email}</span>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <LanguageSelector
              currentLanguage={currentLanguage}
              onLanguageChange={handleLanguageChange}
              detectedLanguage={detectedLanguage}
            />
            <button
              onClick={handleSignOut}
              className="flex items-center space-x-2 px-3 py-2 glass hover:bg-white/10 rounded-xl transition-all text-sm active:scale-95"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="w-full max-w-lg text-center flex flex-col items-center justify-center flex-grow">
          <AIAvatar 
            isUserSpeaking={isUserSpeaking}
            isAISpeaking={isAISpeaking}
            isProcessing={isProcessing}
            isListening={isCallActive && !isUserSpeaking && !isProcessing && !isAISpeaking}
          />
          
          <div className="mb-6">
            <h1 className="text-3xl sm:text-4xl font-bold mb-2 animate-fade-in-up">
              <span className="text-white">humo</span>
              <span className="text-pink-500 text-glow-pink">.ai</span>
            </h1>
            <p className={`transition-colors duration-300 ${getStatusColor()} animate-fade-in-up text-base sm:text-lg`}>
              {getStatusMessage()}
            </p>
          </div>

          <div className="flex justify-center mb-6">
            {!isCallActive ? (
              <button
                onClick={handleStartCall}
                disabled={isProcessing}
                className="w-20 h-20 rounded-full flex items-center justify-center text-2xl transition-all duration-300 bg-emerald-500 hover:bg-emerald-600 shadow-xl disabled:bg-gray-600 disabled:cursor-not-allowed hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
              >
                <Mic />
              </button>
            ) : (
              <button
                onClick={handleEndCall}
                className="w-20 h-20 rounded-full flex items-center justify-center text-2xl transition-all duration-300 bg-red-500 hover:bg-red-600 shadow-xl hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-300/60"
              >
                <MicOff />
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="w-full">
          <div className="flex justify-center gap-2 sm:gap-3 mb-4 flex-wrap">
            <div className={`glass px-3 py-1.5 rounded-full text-xs sm:text-sm flex items-center gap-2 transition-all ${isCallActive ? 'text-sky-300' : 'text-gray-400'}`}>
              <span className={`w-2 h-2 rounded-full ${isCallActive ? 'bg-sky-400 animate-pulse' : 'bg-gray-500'}`} />
              <span>Connected</span>
              <Activity size={14} className={`${isCallActive ? 'text-sky-400' : 'text-gray-500'}`} />
            </div>
            <div className={`glass px-3 py-1.5 rounded-full text-xs sm:text-sm flex items-center gap-2 transition-all ${isUserSpeaking ? 'text-pink-300' : 'text-gray-400'}`}>
              <Volume2 size={14} className={`${isUserSpeaking ? 'text-pink-400 animate-pulse' : 'text-gray-500'}`} />
              <span>Speaking</span>
            </div>
            <div className={`glass px-3 py-1.5 rounded-full text-xs sm:text-sm flex items-center gap-2 transition-all ${isAISpeaking ? 'text-emerald-300' : 'text-gray-400'}`}>
              <MessageSquare size={14} className={`${isAISpeaking ? 'text-emerald-400 animate-pulse' : 'text-gray-500'}`} />
              <span>AI Response</span>
            </div>
          </div>

          {showDisclaimer && (
            <div className="mt-4 p-3 glass border border-blue-500/50 rounded-xl text-blue-200 text-sm max-w-md mx-auto flex items-start">
              <div className="flex-grow">
                <h4 className="font-bold mb-1">Data Usage Notice</h4>
                <p className="text-xs">To improve your experience, your conversations will be used to fine-tune our AI models. Your data will be handled with privacy and care.</p>
              </div>
              <button onClick={() => setShowDisclaimer(false)} className="ml-2 p-1 rounded-full hover:bg-white/10">
                <X size={16} />
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 glass border border-red-500/50 rounded-xl text-red-200 text-sm max-w-md mx-auto">
              <p>❌ {error}</p>
            </div>
          )}

          {detectedLanguage && detectedLanguage !== currentLanguage && currentLanguage !== 'auto' && (
            <div className="mt-4 p-3 glass border border-amber-500/50 rounded-xl text-amber-200 text-sm max-w-md mx-auto">
              <p>💡 Detected {companion.getLanguageDisplayName(detectedLanguage as SupportedLanguage)}. 
                 Switch to "Auto Detect" for seamless multi-language support.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};