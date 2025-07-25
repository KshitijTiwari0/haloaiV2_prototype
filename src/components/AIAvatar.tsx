import React from 'react';

interface AIAvatarProps {
  isRecording?: boolean;
  isProcessing?: boolean;
}

export const AIAvatar: React.FC<AIAvatarProps> = ({ isRecording = false, isProcessing = false }) => {
  return (
    <div className="relative flex items-center justify-center mb-8">
      <div 
        className={`w-48 h-48 rounded-full bg-gradient-to-r from-purple-500 via-cyan-500 to-emerald-500 p-2 ${
          isRecording || isProcessing ? 'animate-spin' : 'animate-pulse'
        }`}
        style={{
          background: isRecording 
            ? 'conic-gradient(from 0deg, #ef4444, #f97316, #eab308, #22c55e, #06b6d4, #8b5cf6, #ef4444)'
            : 'conic-gradient(from 0deg, #8b5cf6, #06b6d4, #10b981, #f59e0b, #ef4444, #8b5cf6)',
          animation: isRecording ? 'spin 2s linear infinite' : 'spin 10s linear infinite'
        }}
      >
        <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center">
          <div className="w-40 h-40 rounded-full bg-gradient-to-br from-gray-100 to-gray-300 flex items-center justify-center relative overflow-hidden">
            <div className="text-6xl">
              {isProcessing ? '🤔' : isRecording ? '👂' : '👨'}
            </div>
            {isRecording && (
              <div className="absolute inset-0 bg-red-500 opacity-20 animate-pulse rounded-full"></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};