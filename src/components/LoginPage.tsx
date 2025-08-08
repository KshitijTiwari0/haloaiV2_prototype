import React from 'react';
import { useState } from 'react';
import { Mail, Chrome, Eye, EyeOff } from 'lucide-react';
import { signInWithEmail, signUpWithEmail, signInWithGoogle } from '../lib/supabase';

export const LoginPage: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error } = await signUpWithEmail(email, password);
        if (error) throw error;
        alert('Check your email for the confirmation link!');
      } else {
        const { error } = await signInWithEmail(email, password);
        if (error) throw error;
        // Auth state change will be handled by App.tsx
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

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
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">
            <span className="text-white">Halo</span>
            <span className="text-red-500">.AI</span>
          </h1>
          <h2 className="text-2xl font-semibold text-white mb-2">
            {isSignUp ? 'Create Account' : "Let's Get Started!"}
          </h2>
          <p className="text-gray-400">Discover the latest 1000+ Voice Effects</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-500 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-emerald-500 transition-colors pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center space-x-3"
            >
              <Mail size={20} />
              <span>{loading ? 'Please wait...' : (isSignUp ? 'Sign Up' : 'Sign In')}</span>
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-900 text-gray-400">or</span>
            </div>
          </div>

          <button
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full bg-gray-800 hover:bg-gray-700 disabled:bg-gray-600 disabled:cursor-not-allowed border border-gray-600 text-white font-medium py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center space-x-3"
          >
            <Chrome size={20} />
            <span>{loading ? 'Please wait...' : 'Continue with Google'}</span>
          </button>

          <div className="text-center mt-8">
            <button 
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-gray-400 hover:text-gray-300 transition-colors"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};