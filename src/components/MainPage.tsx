import React, { useState, useCallback } from 'react';
import { Mic, MicOff, User, LogOut } from 'lucide-react';
import { AIAvatar } from './AIAvatar';
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
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 text-white">
      {/* Header */}
      <div className="absolute top-4 right-4 flex items-center space-x-4">
        <div className="flex items-center space-x-2 text-sm text-gray-300">
          <User size={16} />
          <span>{user?.email}</span>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center space-x-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-sm"
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
          <h1 className="text-3xl font-bold mb-2">
            <span className="text-white">Halo</span>
            <span className="text-red-500">.AI</span>
          </h1>
          <p className={`transition-colors duration-300 ${getStatusColor()}`}>
            {getStatusMessage()}
          </p>
        </div>

        {/* Call Control Button */}
        <div className="flex justify-center mb-8">
          {!isCallActive ? (
            <button
              onClick={handleStartCall}
              disabled={isProcessing}
              className="w-20 h-20 rounded-full flex items-center justify-center text-2xl transition-all duration-300 bg-emerald-500 hover:bg-emerald-600 shadow-lg disabled:bg-gray-600 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
            >
              <Mic />
            </button>
          ) : (
            <button
              onClick={handleEndCall}
              className="w-20 h-20 rounded-full flex items-center justify-center text-2xl transition-all duration-300 bg-red-500 hover:bg-red-600 shadow-lg hover:scale-105 active:scale-95"
            >
              <MicOff />
            </button>
          )}
        </div>

        {/* Visual state indicators */}
        <div className="flex justify-center space-x-4 mb-4">
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm transition-all duration-300 ${
            isCallActive ? 'bg-blue-900/30 text-blue-400' : 'bg-gray-800 text-gray-500'
          }`}>
            <div className={`w-2 h-2 rounded-full ${isCallActive ? 'bg-blue-400' : 'bg-gray-500'}`}></div>
            <span>Connected</span>
          </div>
          
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm transition-all duration-300 ${
            isUserSpeaking ? 'bg-red-900/30 text-red-400' : 'bg-gray-800 text-gray-500'
          }`}>
            <div className={`w-2 h-2 rounded-full ${isUserSpeaking ? 'bg-red-400 animate-pulse' : 'bg-gray-500'}`}></div>
            <span>Speaking</span>
          </div>
          
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm transition-all duration-300 ${
            isAISpeaking ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-500'
          }`}>
            <div className={`w-2 h-2 rounded-full ${isAISpeaking ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}></div>
            <span>AI Response</span>
          </div>
        </div>

        {/* Error messages */}
        {error && (
          <div className="mt-4 p-4 bg-red-900/30 border border-red-500 rounded-lg text-red-200">
            <p>❌ {error}</p>
          </div>
        )}
      </div>
    </div>
  );
};