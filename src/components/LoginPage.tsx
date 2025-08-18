import React from 'react';
import { useState } from 'react';
import { Chrome } from 'lucide-react';
import { signInWithGoogle } from '../lib/supabase';

export const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);

    try {
      const { error } = await signInWithGoogle();
      if (error) throw error;
      // Google auth will redirect, auth state change will be handled by App.tsx
    } catch (error: any) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen text-white">
      <div className="absolute inset-0 bg-aurora animate-gradient-slow" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_0%,transparent_60%,rgba(0,0,0,0.55)_100%)]" />
      <div className="relative z-10 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 animate-fade-in-up">
            <h1 className="text-4xl font-bold mb-2">
              <span className="text-white">humo</span>
              <span className="text-pink-500 text-glow-pink">.ai</span>
            </h1>
            <h2 className="text-2xl font-semibold text-white mb-2">
              Let's Get Started!
            </h2>
            <p className="text-gray-300">Sign in or create an account with Google</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-500 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4 glass rounded-2xl p-6 border border-white/10">
            <button
              onClick={handleGoogleAuth}
              disabled={loading}
              className="w-full bg-white hover:bg-gray-100 disabled:bg-gray-600 disabled:cursor-not-allowed text-gray-900 font-medium py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center space-x-3 hover:scale-[1.01] active:scale-95 shadow-xl"
            >
              <Chrome size={20} />
              <span>{loading ? 'Please wait...' : 'Continue with Google'}</span>
            </button>

            <div className="text-center text-xs text-gray-400 mt-4">
              <p>New to humo.ai? Google will create your account automatically</p>
              <p className="mt-1">By continuing, you agree to our terms of service and privacy policy</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};