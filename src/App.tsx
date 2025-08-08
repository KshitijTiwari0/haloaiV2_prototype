import React, { useState, useEffect } from 'react';
import { useCallback } from 'react';
import { supabase, getCurrentUser } from './lib/supabase';
import { LoginPage } from './components/LoginPage';
import { MainPage } from './components/MainPage';
import { EmotionalAICompanion } from './utils/EmotionalAICompanion';
import { ConfigManager } from './utils/ConfigManager';

// Get API keys from environment variables
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const ELEVEN_LABS_API_KEY = import.meta.env.VITE_ELEVEN_LABS_API_KEY;
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const ASSEMBLYAI_API_KEY = import.meta.env.VITE_ASSEMBLYAI_API_KEY;

function App() {
  const [currentPage, setCurrentPage] = useState<'login' | 'main'>('login');
  const [companion, setCompanion] = useState<EmotionalAICompanion | null>(null);
  const [configManager] = useState(() => new ConfigManager());
  const [isInitializing, setIsInitializing] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [user, setUser] = useState<any>(null);

  // Centralized AI companion initialization
  const initializeAICompanion = useCallback(async () => {
    setIsInitializing(true);
    try {
      console.log('Initializing AI companion...');
      
      // Validate required API keys
      if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === 'your-openrouter-api-key-here') {
        throw new Error('OpenRouter API key is required for AI responses. Please set VITE_OPENROUTER_API_KEY in your environment variables.');
      }

      const newCompanion = new EmotionalAICompanion(OPENROUTER_API_KEY, configManager);
      setCompanion(newCompanion);
      setCurrentPage('main');
      console.log('AI companion initialized successfully');
    } catch (error) {
      console.error('AI companion initialization error:', error);
      alert(`Initialization failed: ${error}`);
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
          // Initialize AI companion for new session
          await initializeAICompanion();
        } else {
          setUser(null);
          setCurrentPage('login');
          setCompanion(null);
        }
      }
    );

    // Set API keys in config manager
    if (OPENROUTER_API_KEY) configManager.set('openrouter_api_key', OPENROUTER_API_KEY);
    if (ELEVEN_LABS_API_KEY) configManager.set('eleven_labs_api_key', ELEVEN_LABS_API_KEY);
    if (OPENAI_API_KEY) configManager.set('openai_api_key', OPENAI_API_KEY);
    if (ASSEMBLYAI_API_KEY) configManager.set('assemblyai_api_key', ASSEMBLYAI_API_KEY);
    
    // Set transcription method to use free services first
    configManager.set('transcription_method', 'auto'); // Will try free services first

    return () => {
      subscription.unsubscribe();
    };
  }, [configManager, initializeAICompanion]);

  if (isCheckingAuth) {
    return (
      <div className="relative min-h-screen text-white">
        <div className="absolute inset-0 bg-aurora animate-gradient-slow" />
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_0%,transparent_60%,rgba(0,0,0,0.55)_100%)]" />
        <div className="relative z-10 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Checking authentication...</p>
        </div>
        </div>
      </div>
    );
  }

  if (isInitializing) {
    return (
      <div className="relative min-h-screen text-white">
        <div className="absolute inset-0 bg-aurora animate-gradient-slow" />
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_0%,transparent_60%,rgba(0,0,0,0.55)_100%)]" />
        <div className="relative z-10 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Initializing AI companion...</p>
          <p className="text-gray-200 text-sm mt-2">Setting up transcription services...</p>
        </div>
        </div>
      </div>
    );
  }

  if (currentPage === 'login') {
    return <LoginPage />;
  }

  if (currentPage === 'main' && companion) {
    return <MainPage companion={companion} configManager={configManager} user={user} />;
  }

  return (
    <div className="relative min-h-screen text-white">
      <div className="absolute inset-0 bg-aurora animate-gradient-slow" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_0%,transparent_60%,rgba(0,0,0,0.55)_100%)]" />
      <div className="relative z-10 min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-white text-lg">Something went wrong. Please refresh the page.</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-6 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
        >
          Refresh
        </button>
      </div>
      </div>
    </div>
  );
}

export default App;