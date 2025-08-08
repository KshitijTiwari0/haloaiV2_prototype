import React from 'react';

interface AIAvatarProps {
  isUserSpeaking?: boolean;
  isAISpeaking?: boolean;
  isProcessing?: boolean;
  isListening?: boolean;
}

export const AIAvatar: React.FC<AIAvatarProps> = ({ 
  isUserSpeaking = false, 
  isAISpeaking = false,
  isProcessing = false,
  isListening = false
}) => {
  
  // Determine animation state
  const getAnimationState = () => {
    if (isAISpeaking) return 'ai-speaking';
    if (isProcessing) return 'processing';
    if (isUserSpeaking) return 'user-speaking';
    if (isListening) return 'listening';
    return 'idle';
  };

  const animationState = getAnimationState();

  // Get border gradient based on state
  const getBorderGradient = () => {
    switch (animationState) {
      case 'ai-speaking':
        return 'conic-gradient(from 0deg, #10b981, #06b6d4, #8b5cf6, #f59e0b, #ef4444, #10b981)';
      case 'user-speaking':
        return 'conic-gradient(from 0deg, #ef4444, #f97316, #eab308, #22c55e, #ef4444)';
      case 'processing':
        return 'conic-gradient(from 0deg, #8b5cf6, #a855f7, #c084fc, #8b5cf6)';
      case 'listening':
        return 'conic-gradient(from 0deg, #06b6d4, #0ea5e9, #0284c7, #06b6d4)';
      default:
        return 'conic-gradient(from 0deg, #374151, #4b5563, #6b7280, #374151)';
    }
  };

  // Get animation duration based on state
  const getAnimationDuration = () => {
    switch (animationState) {
      case 'ai-speaking':
        return '1.5s';
      case 'user-speaking':
        return '1s';
      case 'processing':
        return '2s';
      case 'listening':
        return '3s';
      default:
        return '8s';
    }
  };

  // Get emoji based on state
  const getEmoji = () => {
    switch (animationState) {
      case 'ai-speaking':
        return '🗣️';
      case 'user-speaking':
        return '👂';
      case 'processing':
        return '🤔';
      case 'listening':
        return '👂';
      default:
        return '🤖';
    }
  };

  // Get pulse animation for inner circle
  const getInnerAnimation = () => {
    if (isAISpeaking) {
      return 'animate-pulse';
    } else if (isUserSpeaking) {
      return 'animate-bounce';
    } else if (isProcessing) {
      return 'animate-spin';
    }
    return '';
  };

  return (
    <div className="relative flex items-center justify-center mb-8">
      {/* Outer rotating border */}
      <div 
        className={`w-48 h-48 rounded-full p-2 ${
          animationState !== 'idle' ? 'animate-spin' : 'animate-pulse'
        }`}
        style={{
          background: getBorderGradient(),
          animationDuration: getAnimationDuration(),
        }}
      >
        {/* Inner dark circle */}
        <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center">
          {/* Avatar container */}
          <div className={`w-40 h-40 rounded-full bg-gradient-to-br from-gray-100 to-gray-300 flex items-center justify-center relative overflow-hidden ${getInnerAnimation()}`}>
            
            {/* Main emoji */}
            <div className="text-6xl z-10 relative">
              {getEmoji()}
            </div>

            {/* Speaking animation overlay */}
            {isAISpeaking && (
              <>
                <div className="absolute inset-0 bg-green-500 opacity-20 animate-pulse rounded-full"></div>
                {/* Sound wave rings */}
                <div className="absolute inset-0 rounded-full border-4 border-green-400 opacity-60 animate-ping"></div>
                <div className="absolute inset-2 rounded-full border-2 border-green-300 opacity-40 animate-ping" style={{ animationDelay: '0.2s' }}></div>
                <div className="absolute inset-4 rounded-full border border-green-200 opacity-20 animate-ping" style={{ animationDelay: '0.4s' }}></div>
              </>
            )}

            {/* User speaking animation overlay */}
            {isUserSpeaking && (
              <>
                <div className="absolute inset-0 bg-red-500 opacity-20 animate-pulse rounded-full"></div>
                {/* Listening wave rings */}
                <div className="absolute inset-0 rounded-full border-4 border-red-400 opacity-60 animate-ping"></div>
                <div className="absolute inset-1 rounded-full border-2 border-red-300 opacity-40 animate-ping" style={{ animationDelay: '0.3s' }}></div>
              </>
            )}

            {/* Processing animation overlay */}
            {isProcessing && (
              <>
                <div className="absolute inset-0 bg-purple-500 opacity-20 animate-pulse rounded-full"></div>
                {/* Thinking dots */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </>
            )}

            {/* Listening animation overlay */}
            {isListening && !isUserSpeaking && !isProcessing && !isAISpeaking && (
              <>
                <div className="absolute inset-0 bg-blue-500 opacity-10 animate-pulse rounded-full"></div>
                {/* Gentle listening pulse */}
                <div className="absolute inset-0 rounded-full border-2 border-blue-300 opacity-30 animate-pulse"></div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Status indicator dots */}
      <div className="absolute -bottom-4 flex space-x-2">
        <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
          isListening ? 'bg-blue-400 animate-pulse' : 'bg-gray-600'
        }`}></div>
        <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
          isUserSpeaking ? 'bg-red-400 animate-bounce' : 'bg-gray-600'
        }`}></div>
        <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
          isProcessing ? 'bg-purple-400 animate-spin' : 'bg-gray-600'
        }`}></div>
        <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
          isAISpeaking ? 'bg-green-400 animate-pulse' : 'bg-gray-600'
        }`}></div>
      </div>

      {/* Floating particles for AI speaking */}
      {isAISpeaking && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-green-400 rounded-full opacity-60 animate-bounce"
              style={{
                left: `${20 + i * 12}%`,
                top: `${30 + (i % 2) * 40}%`,
                animationDelay: `${i * 0.2}s`,
                animationDuration: '1.5s'
              }}
            ></div>
          ))}
        </div>
      )}

      {/* Sound wave bars for user speaking */}
      {isUserSpeaking && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex items-end space-x-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-red-400 rounded-full animate-pulse"
                style={{
                  height: `${Math.random() * 20 + 10}px`,
                  animationDelay: `${i * 0.1}s`,
                  animationDuration: '0.6s'
                }}
              ></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};