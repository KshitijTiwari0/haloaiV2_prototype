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
  const [aiResponse, setAiResponse] = useState(''); // State to hold the streaming response
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

      // Setup all UI callbacks
      companion.setOnSpeechStart(() => setIsUserSpeaking(true));
      companion.setOnSpeechEnd(() => {
          setIsUserSpeaking(false);
          // When user stops speaking, clear previous response and enter processing state
          setAiResponse(''); 
          setIsProcessing(true);
      });
      companion.setOnProcessingEnd(() => setIsProcessing(false));
      
      // Connect the streaming callback to update the UI
      companion.setOnAIResponseStream((chunk) => {
          // Append each new chunk to the aiResponse state
          setAiResponse(prev => prev + chunk);
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
      setError(null);
      setAiResponse(''); // Clear response on call end
      console.log('Call ended successfully');
    } catch (err) {
      console.error('Call end error:', err);
      setError(err instanceof Error ? err.message : 'Error ending call');
    }
  }, [companion, isCallActive]);


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
        <AIAvatar isRecording={isUserSpeaking} isProcessing={isProcessing} />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            <span className="text-white">Halo</span>
            <span className="text-red-500">.AI</span>
          </h1>
          <p className="text-gray-400">
            {!isCallActive ? 'Tap to start your conversation' :
             isProcessing && !aiResponse ? 'AI is thinking...' :
             isUserSpeaking ? 'You are speaking...' :
             'Listening...'}
          </p>
        </div>

        {/* Call Control Button */}
        <div className="flex justify-center mb-8">
          {!isCallActive ? (
            <button
              onClick={handleStartCall}
              disabled={isProcessing}
              className="w-20 h-20 rounded-full flex items-center justify-center text-2xl transition-all duration-300 bg-emerald-500 hover:bg-emerald-600 shadow-lg disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              <Mic />
            </button>
          ) : (
            <button
              onClick={handleEndCall}
              className="w-20 h-20 rounded-full flex items-center justify-center text-2xl transition-all duration-300 bg-red-500 hover:bg-red-600 shadow-lg"
            >
              <MicOff />
            </button>
          )}
        </div>

        {/* AI Response Display Area */}
        <div className="min-h-[6rem] p-4 bg-gray-800/50 rounded-lg text-left text-lg text-gray-200 whitespace-pre-wrap">
          {aiResponse}
          {isProcessing && !aiResponse && <span className="animate-pulse">...</span>}
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-900/30 border border-red-500 rounded-lg text-red-200">
            <p>❌ {error}</p>
          </div>
        )}
      </div>
    </div>
  );
};