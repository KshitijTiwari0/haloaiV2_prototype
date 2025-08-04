import React, { useState, useCallback, useEffect } from 'react';
import { Mic, MicOff, Settings, MessageCircle, LogOut, User } from 'lucide-react';
import { AIAvatar } from './AIAvatar';
import { EmotionalAICompanion } from '../utils/EmotionalAICompanion';
import { ConfigManager } from '../utils/ConfigManager';
import { Interaction } from '../types';
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
  const [currentInteraction, setCurrentInteraction] = useState<Interaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      setSuccess(null);

      // MODIFIED: Set up the callbacks to update the UI
      companion.setOnSpeechStart(() => setIsUserSpeaking(true));
      companion.setOnSpeechEnd(() => setIsUserSpeaking(false));
      companion.setOnProcessingStart(() => setIsProcessing(true));
      companion.setOnProcessingEnd(() => setIsProcessing(false));

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
      setError(null);
      setSuccess(null);
      console.log('Call ended successfully');
    } catch (err) {
      console.error('Call end error:', err);
      setError(err instanceof Error ? err.message : 'Error ending call');
    } finally {
      setIsCallActive(false);
      setIsUserSpeaking(false);
    }
  }, [companion, isCallActive]);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
    setCurrentInteraction(null);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 text-white">
      {/* Header with user info and sign out */}
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

      <div className="w-full max-w-md text-center">
        <AIAvatar isRecording={isUserSpeaking} isProcessing={isProcessing} />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            <span className="text-white">Halo</span>
            <span className="text-red-500">.AI</span>
          </h1>
          <p className="text-gray-400">
            {!isCallActive ? 'Tap to start call with your AI companion' :
             isProcessing ? 'AI is thinking...' :
             isUserSpeaking ? 'You are speaking...' :
             'Listening...'}
          </p>
        </div>

        {/* Call Control Buttons */}
        <div className="mb-12">
          {!isCallActive ? (
            <button
              onClick={handleStartCall}
              disabled={isProcessing}
              className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl transition-all duration-300 ${
                isProcessing
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-emerald-500 hover:bg-emerald-600 hover:scale-105 shadow-lg'
              }`}
            >
              <Mic />
            </button>
          ) : (
            <button
              onClick={handleEndCall}
              className="w-20 h-20 rounded-full flex items-center justify-center text-2xl transition-all duration-300 bg-red-500 hover:bg-red-600 hover:scale-105 shadow-lg"
            >
              <MicOff />
            </button>
          )}
        </div>

        {/* Status Messages - Only show errors */}
        {error && (
          <div className="mb-4 p-4 bg-red-900/30 border border-red-500 rounded-lg">
            <p className="text-red-200">❌ {error}</p>
            <button 
              onClick={clearMessages}
              className="mt-2 text-sm text-red-300 hover:text-red-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Instructions */}
        <div className="text-center text-gray-400 text-sm">
          <p className="mb-2">
            {!isCallActive 
              ? 'Start a continuous conversation with your AI companion'
              : 'Speak naturally - the conversation continues until you end the call'
            }
          </p>
          <p>
            {!isCallActive
              ? 'Your voice and emotions will be analyzed in real-time'
              : 'End the call when you\'re ready to finish the conversation'
            }
          </p>
        </div>
      </div>
    </div>
  );
};