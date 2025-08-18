import React, { useState, useEffect } from 'react';
import { useCallback } from 'react';
import { supabase, getCurrentUser } from './lib/supabase';
import { LoginPage } from './components/LoginPage';
import { MainPage } from './components/MainPage';
import { EmotionalAICompanion } from './utils/EmotionalAICompanion';
import { ConfigManager } from './utils/ConfigManager';
import { User } from '@supabase/supabase-js';

// Get API keys from environment variables - simplified to only required ones
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const ELEVEN_LABS_API_KEY = import.meta.env.VITE_ELEVEN_LABS_API_KEY;

function App() {
  const [currentPage, setCurrentPage] = useState<'login' | 'main'>('login');
  const [companion, setCompanion] = useState<EmotionalAICompanion | null>(null);
  const [configManager] = useState(() => new ConfigManager());
  const [isInitializing, setIsInitializing] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  // Centralized AI companion initialization
  const initializeAICompanion = useCallback(async () => {
    setIsInitializing(true);
    setInitError(null);
    
    try {
      console.log('Initializing AI companion with OpenAI + Eleven Labs...');
      
      // Validate required API keys
      if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-openai-api-key-here') {
        throw new Error('OpenAI API key is required. Please set VITE_OPENAI_API_KEY in your environment variables.');
      }

      if (!ELEVEN_LABS_API_KEY || ELEVEN_LABS_API_KEY === 'your-eleven-labs-api-key-here') {
        throw new Error('Eleven Labs API key is required. Please set VITE_ELEVEN_LABS_API_KEY in your environment variables.');
      }

      // Initialize the companion
      const newCompanion = new EmotionalAICompanion(
        OPENAI_API_KEY,
        ELEVEN_LABS_API_KEY,
        configManager
      );

      // Validate setup
      const validation = await newCompanion.validateSetup();
      if (!validation.valid) {
        throw new Error(`Setup validation failed: ${validation.errors.join(', ')}`);
      }

      setCompanion(newCompanion);
      setCurrentPage('main');
      console.log('AI companion initialized successfully');
      
    } catch (error) {
      console.error('AI companion initialization error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
      setInitError(errorMessage);
      
      // Reset to login page if initialization fails
      setCurrentPage('login');
      setCompanion(null);
    } finally {
      setIsInitializing(false);
    }
  }, [configManager]);

  useEffect(() => {
    // Check for existing session
    const checkAuth = async () => {
      try {
        const { user } = await getCurrentUser();
        if (user) {
          setUser(user);
          console.log('Existing user session found:', user.email);
          // Initialize AI companion for existing session
          await initializeAICompanion();
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        
        if (session?.user) {
          setUser(session.user);
          console.log('New user session:', session.user.email);
          // Initialize AI companion for new session
          await initializeAICompanion();
        } else {
          console.log('User logged out');
          setUser(null);
          setCurrentPage('login');
          setCompanion(null);
          setInitError(null);
        }
      }
    );

    // Log configuration summary for debugging
    .log('Configuration Summary:', {
      hasOpenAI: !!OPENAI_API_KEY,
      hasElevenLabs: !!ELEVEN_LABS_API_KEY,
      cconsoleonfigSummary: configManager.getConfigSummary()
    });

    return () => {
      subscription.unsubscribe();
      // Cleanup companion on unmount
      if (companion) {
        companion.stopCall();
      }
    };
  }, [configManager, initializeAICompanion]);

  // Loading screen component
  const LoadingScreen = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div className="relative min-h-screen text-white">
      <div className="absolute inset-0 bg-aurora animate-gradient-slow" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_0%,transparent_60%,rgba(0,0,0,0.55)_100%)]" />
      <div className="relative z-10 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">{title}</p>
          {subtitle && <p className="text-gray-200 text-sm mt-2">{subtitle}</p>}
        </div>
      </div>
    </div>
  );

  // Error screen component
  const ErrorScreen = ({ error }: { error: string }) => (
    <div className="relative min-h-screen text-white">
      <div className="absolute inset-0 bg-aurora animate-gradient-slow" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_0%,transparent_60%,rgba(0,0,0,0.55)_100%)]" />
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-red-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-4">Initialization Error</h2>
          <p className="text-gray-200 text-sm mb-6 leading-relaxed">{error}</p>
          <div className="space-y-2">
            <button 
              onClick={() => window.location.reload()}
              className="w-full px-6 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
            >
              Retry
            </button>
            <button 
              onClick={() => {
                setInitError(null);
                setCurrentPage('login');
              }}
              className="w-full px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Handle different app states
  if (isCheckingAuth) {
    return <LoadingScreen title="Checking authentication..." />;
  }

  if (initError) {
    return <ErrorScreen error={initError} />;
  }

  if (isInitializing) {
    return <LoadingScreen 
      title="Initializing AI companion..." 
      subtitle="Setting up OpenAI Whisper and Eleven Labs..."
    />;
  }

  if (currentPage === 'login') {
    return <LoginPage />;
  }

  if (currentPage === 'main' && companion && user) {
    return <MainPage companion={companion} configManager={configManager} user={user} />;
  }

  // Fallback error state
  return <ErrorScreen error="Something went wrong. Please refresh the page and try again." />;
}

export default App;