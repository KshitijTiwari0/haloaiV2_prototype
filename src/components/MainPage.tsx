import React, { useState, useCallback } from 'react';
import { Mic, MicOff, User as UserIcon, LogOut, Activity, Volume2, MessageSquare } from 'lucide-react';
import { AIAvatar } from './AIAvatar';
import BackgroundFX from './BackgroundFX';
import { EmotionalAICompanion } from '../utils/EmotionalAICompanion';
import { ConfigManager } from '../utils/ConfigManager';
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

  const handleSignOut = async () => {
    try {
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
      
      console.log('Starting call...');
      await companion.startCall();
      console.log('Call started successfully');

    } catch (err) {
      console.error('Call start error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsCallActive(false);
    }
  }, [companion, isCallActive, isProcessing]);

  const handleEndCall = useCallback(() => {
    if (!isCallActive) return;
    try {
      console.log('Ending call...');
      companion.stopCall();
      setIsCallActive(false);
      setIsUserSpeaking(false);
      setIsProcessing(false);
      setIsAISpeaking(false);
      setError(null);
      console.log('Call ended successfully');
    } catch (err) {
      console.error('Call end error:', err);
      setError(err instanceof Error ? err.message : 'Error ending call');
    }
  }, [companion, isCallActive]);

  // Get status message based on current state
  const getStatusMessage = () => {
    if (!isCallActive) return 'Tap to start your conversation';
    if (isAISpeaking) return 'AI is responding...';
    if (isProcessing) return 'Processing your message...';
    if (isUserSpeaking) return 'Listening to you...';
    return 'Ready to listen...';
  };

  // Get status color based on current state
  const getStatusColor = () => {
    if (!isCallActive) return 'text-gray-400';
    if (isAISpeaking) return 'text-green-400';
    if (isProcessing) return 'text-purple-400';
    if (isUserSpeaking) return 'text-red-400';
    return 'text-blue-400';
  };

  return (
    <div className="relative min-h-screen text-white">
      <BackgroundFX />
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="absolute top-4 right-4 flex items-center space-x-4">
        <div className="flex items-center space-x-2 text-sm text-gray-200">
          <UserIcon size={16} />
          <span>{user?.email}</span>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center space-x-2 px-3 py-2 glass hover:bg-white/10 rounded-xl transition-all text-sm active:scale-95"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
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
        </div>

        {/* Call Control Button */}
        <div className="flex justify-center mb-8">
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

        {/* Visual state indicators as animated gradient pills */}
        <div className="flex justify-center gap-3 mb-4">
          <div className={`glass px-3 py-1.5 rounded-full text-sm flex items-center gap-2 transition-all ${isCallActive ? 'text-sky-300' : 'text-gray-400'}`}>
            <span className={`w-2 h-2 rounded-full ${isCallActive ? 'bg-sky-400 animate-pulse' : 'bg-gray-500'}`} />
            <span className="hidden sm:inline">Connected</span>
            <Activity size={14} className={`${isCallActive ? 'text-sky-400' : 'text-gray-500'}`} />
          </div>
          <div className={`glass px-3 py-1.5 rounded-full text-sm flex items-center gap-2 transition-all ${isUserSpeaking ? 'text-pink-300' : 'text-gray-400'}`}>
            <Volume2 size={14} className={`${isUserSpeaking ? 'text-pink-400 animate-pulse' : 'text-gray-500'}`} />
            <span className="hidden sm:inline">Speaking</span>
          </div>
          <div className={`glass px-3 py-1.5 rounded-full text-sm flex items-center gap-2 transition-all ${isAISpeaking ? 'text-emerald-300' : 'text-gray-400'}`}>
            <MessageSquare size={14} className={`${isAISpeaking ? 'text-emerald-400 animate-pulse' : 'text-gray-500'}`} />
            <span className="hidden sm:inline">AI Response</span>
          </div>
        </div>

        {/* Error messages */}
        {error && (
          <div className="mt-4 p-4 glass border border-red-500/50 rounded-xl text-red-200">
            <p>❌ {error}</p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};