import React, { useState, useCallback, useEffect } from 'react';
import { Mic, MicOff, User, LogOut, Activity, Volume2, MessageSquare, RefreshCw } from 'lucide-react';
import { AIAvatar } from './AIAvatar';
import BackgroundFX from './BackgroundFX';
import { EmotionalAICompanion } from '../utils/EmotionalAICompanion';
import { ConfigManager } from '../utils/ConfigManager';
import { signOut } from '../lib/supabase';

interface MainPageProps {
  companion: EmotionalAICompanion;
  configManager: ConfigManager;
  user: any;
}

export const MainPage: React.FC<MainPageProps> = ({ companion, configManager, user }) => {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsManualRestart, setNeedsManualRestart] = useState(false);
  
  // Mobile detection
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleSignOut = async () => {
    try {
      // Stop any active call first
      if (isCallActive) {
        handleEndCall();
      }
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleStartCall = useCallback(async () => {
    if (isCallActive || isProcessing) return;
    
    try {
      setIsCallActive(true);
      setError(null);
      setNeedsManualRestart(false);

      // Request microphone permission explicitly on mobile
      if (isMobile) {
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true });
          console.log('Microphone permission granted');
        } catch (permError) {
          console.error('Microphone permission error:', permError);
          setError('Microphone access is required. Please allow microphone access in your browser settings.');
          setIsCallActive(false);
          return;
        }
      }

      // Setup UI callbacks for avatar state
      companion.setOnSpeechStart(() => {
        console.log('Speech started');
        setIsUserSpeaking(true);
        setNeedsManualRestart(false);
      });
      
      companion.setOnSpeechEnd(() => {
        console.log('Speech ended');
        setIsUserSpeaking(false);
        // On mobile, often need manual restart after processing
        if (isMobile) {
          setTimeout(() => {
            setNeedsManualRestart(true);
          }, 2000);
        }
      });
      
      companion.setOnProcessingStart(() => {
        console.log('Processing started');
        setIsProcessing(true);
        setIsUserSpeaking(false);
        setNeedsManualRestart(false);
      });
      
      companion.setOnProcessingEnd(() => {
        console.log('Processing ended');
        setIsProcessing(false);
      });

      // Setup AI speaking callbacks
      companion.setOnAISpeakingStart(() => {
        console.log('AI speaking started');
        setIsAISpeaking(true);
        setIsProcessing(false);
        setNeedsManualRestart(false);
      });

      companion.setOnAISpeakingEnd(() => {
        console.log('AI speaking ended');
        setIsAISpeaking(false);
        // On mobile, show restart button after AI finishes
        if (isMobile) {
          setTimeout(() => {
            setNeedsManualRestart(true);
          }, 1000);
        }
      });
      
      console.log('Starting call...');
      await companion.startCall();
      console.log('Call started successfully');

      // On mobile, show helpful message
      if (isAndroid) {
        setTimeout(() => {
          if (isCallActive && !isUserSpeaking && !isProcessing && !isAISpeaking) {
            setError('Tap the microphone and speak when ready');
            setTimeout(() => setError(null), 3000);
          }
        }, 2000);
      }

    } catch (err) {
      console.error('Call start error:', err);
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      setIsCallActive(false);
    }
  }, [companion, isCallActive, isProcessing, isMobile, isAndroid]);

  const handleEndCall = useCallback(() => {
    if (!isCallActive) return;
    try {
      console.log('Ending call...');
      companion.stopCall();
      setIsCallActive(false);
      setIsUserSpeaking(false);
      setIsProcessing(false);
      setIsAISpeaking(false);
      setNeedsManualRestart(false);
      setError(null);
      console.log('Call ended successfully');
    } catch (err) {
      console.error('Call end error:', err);
      setError(err instanceof Error ? err.message : 'Error ending call');
    }
  }, [companion, isCallActive]);

  // Manual restart function for mobile
  const handleManualRestart = useCallback(() => {
    if (!isCallActive) return;
    
    try {
      // Use the restartRecognition method from AudioProcessor
      (companion as any).audioProcessor?.restartRecognition();
      setNeedsManualRestart(false);
      setError(null);
      console.log('Manual restart triggered');
    } catch (err) {
      console.error('Manual restart error:', err);
      setError('Failed to restart voice recognition');
    }
  }, [companion, isCallActive]);

  // Get status message based on current state
  const getStatusMessage = () => {
    if (!isCallActive) {
      return isMobile ? 'Tap to start talking' : 'Click to start your conversation';
    }
    if (isAISpeaking) return 'AI is responding...';
    if (isProcessing) return 'Processing your message...';
    if (isUserSpeaking) return 'Listening to you...';
    if (needsManualRestart && isMobile) return 'Tap the microphone to continue';
    return 'Ready to listen...';
  };

  // Get status color based on current state
  const getStatusColor = () => {
    if (!isCallActive) return 'text-gray-400';
    if (isAISpeaking) return 'text-green-400';
    if (isProcessing) return 'text-purple-400';
    if (isUserSpeaking) return 'text-red-400';
    if (needsManualRestart) return 'text-yellow-400';
    return 'text-blue-400';
  };

  return (
    <div className="relative min-h-screen text-white">
      <BackgroundFX />
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
        {/* Header */}
        <div className="absolute top-4 right-4 flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-sm text-gray-200">
            <User size={16} />
            <span className="hidden sm:inline">{user?.email}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center space-x-2 px-3 py-2 glass hover:bg-white/10 rounded-xl transition-all text-sm active:scale-95"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>

        <div className="w-full max-w-lg text-center">
          {/* Enhanced Avatar with animations */}
          <AIAvatar 
            isUserSpeaking={isUserSpeaking}
            isAISpeaking={isAISpeaking}
            isProcessing={isProcessing}
            isListening={isCallActive && !isUserSpeaking && !isProcessing && !isAISpeaking}
          />
          
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2 animate-fade-in-up">
              <span className="text-white">humo</span>
              <span className="text-pink-500 text-glow-pink">.ai</span>
            </h1>
            <p className={`transition-colors duration-300 ${getStatusColor()} animate-fade-in-up`}>
              {getStatusMessage()}
            </p>
            {isAndroid && isCallActive && (
              <p className="text-xs text-gray-400 mt-1">
                Android voice recognition may require manual restart
              </p>
            )}
          </div>

          {/* Call Control Buttons */}
          <div className="flex justify-center items-center gap-4 mb-8">
            {!isCallActive ? (
              <button
                onClick={handleStartCall}
                disabled={isProcessing}
                className="w-20 h-20 rounded-full flex items-center justify-center text-2xl transition-all duration-300 bg-emerald-500 hover:bg-emerald-600 shadow-xl disabled:bg-gray-600 disabled:cursor-not-allowed hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
              >
                <Mic />
              </button>
            ) : (
              <>
                {/* Main microphone button */}
                <button
                  onClick={needsManualRestart ? handleManualRestart : handleEndCall}
                  className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl transition-all duration-300 shadow-xl hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 ${
                    needsManualRestart 
                      ? 'bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-300/60' 
                      : 'bg-red-500 hover:bg-red-600 focus:ring-red-300/60'
                  }`}
                >
                  {needsManualRestart ? <RefreshCw /> : <MicOff />}
                </button>
                
                {/* Additional restart button for mobile when needed */}
                {needsManualRestart && isMobile && (
                  <button
                    onClick={handleEndCall}
                    className="w-12 h-12 rounded-full flex items-center justify-center text-lg transition-all duration-300 bg-red-500 hover:bg-red-600 shadow-lg hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-300/60"
                    title="End call"
                  >
                    <MicOff />
                  </button>
                )}
              </>
            )}
          </div>

          {/* Mobile-specific instructions */}
          {isMobile && needsManualRestart && (
            <div className="mb-4 p-3 glass rounded-xl text-yellow-200 text-sm">
              <p>🔄 Tap the yellow button to continue listening</p>
              <p className="text-xs mt-1">or tap the red button to end the conversation</p>
            </div>
          )}

          {/* Visual state indicators as animated gradient pills */}
          <div className="flex justify-center gap-2 sm:gap-3 mb-4 flex-wrap">
            <div className={`glass px-2 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm flex items-center gap-1 sm:gap-2 transition-all ${isCallActive ? 'text-sky-300' : 'text-gray-400'}`}>
              <span className={`w-2 h-2 rounded-full ${isCallActive ? 'bg-sky-400 animate-pulse' : 'bg-gray-500'}`} />
              <span>Connected</span>
              <Activity size={12} className={`${isCallActive ? 'text-sky-400' : 'text-gray-500'}`} />
            </div>
            <div className={`glass px-2 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm flex items-center gap-1 sm:gap-2 transition-all ${isUserSpeaking ? 'text-pink-300' : 'text-gray-400'}`}>
              <Volume2 size={12} className={`${isUserSpeaking ? 'text-pink-400 animate-pulse' : 'text-gray-500'}`} />
              <span>Speaking</span>
            </div>
            <div className={`glass px-2 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm flex items-center gap-1 sm:gap-2 transition-all ${isAISpeaking ? 'text-emerald-300' : 'text-gray-400'}`}>
              <MessageSquare size={12} className={`${isAISpeaking ? 'text-emerald-400 animate-pulse' : 'text-gray-500'}`} />
              <span>AI Response</span>
            </div>
          </div>

          {/* Error messages */}
          {error && (
            <div className="mt-4 p-4 glass border border-red-500/50 rounded-xl text-red-200 text-sm">
              <p>❌ {error}</p>
              {error.includes('Microphone') && isAndroid && (
                <div className="mt-2 text-xs text-gray-300">
                  <p>For Android Chrome:</p>
                  <p>1. Tap the 🔒 icon in the address bar</p>
                  <p>2. Enable "Microphone" permission</p>
                  <p>3. Refresh the page</p>
                </div>
              )}
            </div>
          )}

          {/* Mobile usage tips */}
          {isMobile && !isCallActive && (
            <div className="mt-6 p-4 glass rounded-xl text-gray-300 text-sm">
              <h3 className="font-medium mb-2">📱 Mobile Tips:</h3>
              <ul className="text-left space-y-1 text-xs">
                <li>• Ensure microphone permission is granted</li>
                <li>• Speak clearly and wait for the AI response</li>
                <li>• Tap the refresh button if voice stops working</li>
                {isAndroid && <li>• Chrome works best for voice recognition</li>}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};