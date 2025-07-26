import React, { useState, useCallback } from 'react';
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
  const [isRecording, setIsRecording] = useState(false);
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

  const handleRecord = useCallback(async () => {
    if (isRecording || isProcessing) return;

    try {
      setIsRecording(true);
      setError(null);
      setSuccess(null);

      console.log('Starting recording...');
      const audioBlob = await companion.recordWithVAD();
      
      if (!audioBlob) {
        throw new Error('No audio captured. Check your microphone.');
      }

      setIsRecording(false);
      setIsProcessing(true);

      console.log('Transcribing audio...');
      const transcribedText = await companion.transcribeAudio(audioBlob);
      
      if (!transcribedText) {
        throw new Error('Could not transcribe audio. Please try again.');
      }

      console.log('Transcribed:', transcribedText);
      setSuccess(`You said: ${transcribedText}`);

      console.log('Processing interaction...');
      const interaction = await companion.processAudio(audioBlob, transcribedText);
      
      if (interaction) {
        setCurrentInteraction(interaction);
        console.log('Interaction completed:', interaction);
      } else {
        throw new Error('No response generated');
      }

    } catch (err) {
      console.error('Recording/processing error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsRecording(false);
      setIsProcessing(false);
    }
  }, [companion, isRecording, isProcessing]);

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
        <AIAvatar isRecording={isRecording} isProcessing={isProcessing} />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            <span className="text-white">Halo</span>
            <span className="text-red-500">.AI</span>
          </h1>
          <p className="text-gray-400">
            {isRecording ? 'Listening...' : 
             isProcessing ? 'Processing...' : 
             'Tap to speak with your AI companion'}
          </p>
        </div>

        {/* Record Button */}
        <div className="mb-12">
          <button
            onClick={handleRecord}
            disabled={isRecording || isProcessing}
            className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl transition-all duration-300 ${
              isRecording || isProcessing
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-emerald-500 hover:bg-emerald-600 hover:scale-105 shadow-lg'
            }`}
          >
            {isRecording ? <MicOff /> : <Mic />}
          </button>
        </div>

        {/* Hidden Status Messages - Only show errors */}
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
          <p className="mb-2">Speak naturally and I'll respond with empathy</p>
          <p>Your voice and emotions are analyzed in real-time</p>
        </div>
      </div>
    </div>
  );
};