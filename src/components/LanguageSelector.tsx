import React, { useState } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { SupportedLanguage } from '../utils/ConfigManager';

interface LanguageSelectorProps {
  currentLanguage: SupportedLanguage;
  onLanguageChange: (language: SupportedLanguage) => void;
  detectedLanguage?: string;
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  currentLanguage,
  onLanguageChange,
  detectedLanguage,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const languages = [
    { code: 'auto' as SupportedLanguage, name: 'Auto Detect', nativeName: 'Auto', flag: '🌐', rtl: false },
    { code: 'en' as SupportedLanguage, name: 'English', nativeName: 'English', flag: '🇺🇸', rtl: false },
    { code: 'hi' as SupportedLanguage, name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', rtl: false },
    { code: 'ar' as SupportedLanguage, name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', rtl: true }
  ];

  const getCurrentLanguageInfo = () => {
    return languages.find(lang => lang.code === currentLanguage) || languages[0];
  };

  const handleLanguageSelect = (language: SupportedLanguage) => {
    onLanguageChange(language);
    setIsOpen(false);
  };

  const currentLangInfo = getCurrentLanguageInfo();

  return (
    <div className={`relative ${className}`}>
      {/* Language Status Indicator */}
      {detectedLanguage && detectedLanguage !== currentLanguage && currentLanguage !== 'auto' && (
        <div className="absolute -top-8 left-0 right-0 text-xs text-amber-400 text-center animate-fade-in-up">
          Detected: {languages.find(l => l.code === detectedLanguage)?.nativeName || detectedLanguage}
        </div>
      )}

      {/* Main Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 px-3 py-2 glass hover:bg-white/10 rounded-xl transition-all active:scale-95 ${
          isOpen ? 'bg-white/10' : ''
        }`}
        aria-label="Select language"
      >
        <Globe size={16} className="text-gray-300" />
        <span className="text-sm font-medium text-white flex items-center space-x-1">
          <span>{currentLangInfo.flag}</span>
          <span className={currentLangInfo.rtl ? 'text-right' : ''}>{currentLangInfo.nativeName}</span>
        </span>
        <ChevronDown 
          size={14} 
          className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute top-full mt-2 left-0 z-20 min-w-full bg-slate-800/95 backdrop-blur-md border border-white/10 rounded-xl shadow-xl overflow-hidden animate-fade-in-up">
            <div className="py-2">
              {languages.map((language) => (
                <button
                  key={language.code}
                  onClick={() => handleLanguageSelect(language.code)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors ${
                    currentLanguage === language.code ? 'bg-emerald-500/10 text-emerald-400' : 'text-gray-200'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{language.flag}</span>
                    <div className={`flex flex-col ${language.rtl ? 'text-right' : ''}`}>
                      <span className="text-sm font-medium">{language.nativeName}</span>
                      <span className="text-xs text-gray-400">{language.name}</span>
                    </div>
                  </div>
                  
                  {/* Status indicators */}
                  <div className="flex items-center space-x-2">
                    {/* Detected language indicator */}
                    {detectedLanguage === language.code && (
                      <span className="text-xs px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full">
                        Detected
                      </span>
                    )}
                    
                    {/* Current selection indicator */}
                    {currentLanguage === language.code && (
                      <Check size={16} className="text-emerald-400" />
                    )}
                    
                    {/* RTL indicator */}
                    {language.rtl && (
                      <span className="text-xs text-gray-500">RTL</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
            
            {/* Footer with language info */}
            <div className="border-t border-white/10 px-4 py-3 bg-slate-900/50">
              <div className="text-xs text-gray-400">
                {currentLanguage === 'auto' ? (
                  <span>Auto-detecting language from speech</span>
                ) : (
                  <span>Voice: {getCurrentLanguageInfo().nativeName} • TTS optimized</span>
                )}
              </div>
              {detectedLanguage && detectedLanguage !== currentLanguage && (
                <div className="text-xs text-amber-400 mt-1">
                  💡 Detected {languages.find(l => l.code === detectedLanguage)?.nativeName}, 
                  switch to auto-detect for seamless experience
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};