import React from 'react';
import { Smartphone, Mic, VolumeX, Settings } from 'lucide-react';

interface IOSInstructionsProps {
  isVisible: boolean;
  onClose: () => void;
}

export const IOSInstructions: React.FC<IOSInstructionsProps> = ({ isVisible, onClose }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="glass rounded-2xl p-6 max-w-md w-full border border-white/20">
        <div className="text-center mb-6">
          <Smartphone className="w-12 h-12 text-blue-400 mx-auto mb-3" />
          <h3 className="text-xl font-semibold text-white mb-2">iOS Setup Required</h3>
          <p className="text-gray-300 text-sm">
            For the best experience on iOS, please follow these steps:
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
              1
            </div>
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <Mic className="w-4 h-4 text-blue-400" />
                <span className="text-white font-medium text-sm">Allow Microphone Access</span>
              </div>
              <p className="text-gray-300 text-xs">
                Tap "Allow" when prompted for microphone permission. This is required for voice recording.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
              2
            </div>
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <VolumeX className="w-4 h-4 text-blue-400" />
                <span className="text-white font-medium text-sm">Disable Silent Mode</span>
              </div>
              <p className="text-gray-300 text-xs">
                Turn off the mute switch on your iPhone/iPad to hear AI responses.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
              3
            </div>
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <Settings className="w-4 h-4 text-blue-400" />
                <span className="text-white font-medium text-sm">Keep Screen Active</span>
              </div>
              <p className="text-gray-300 text-xs">
                Keep the app open and screen active during conversations for best performance.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-6">
          <p className="text-amber-200 text-xs text-center">
            💡 <strong>Tip:</strong> If audio doesn't work, try refreshing the page and tapping the microphone button immediately after granting permissions.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-colors"
          >
            I understand, let's continue
          </button>
          
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-xl transition-colors text-sm"
          >
            Refresh page
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper function to detect iOS
export const isIOSDevice = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};