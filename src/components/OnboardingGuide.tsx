import React, { useState, useEffect, useRef } from 'react';
import { OnboardingStep } from '../types';

interface OnboardingGuideProps {
  steps: OnboardingStep[];
  onClose: () => void;
}

export const OnboardingGuide: React.FC<OnboardingGuideProps> = ({ steps, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const step = steps[currentStep];
  const targetRef = useRef<Element | null>(null);

  useEffect(() => {
    const updatePosition = () => {
      targetRef.current = document.querySelector(step.target);
      if (targetRef.current) {
        const rect = targetRef.current.getBoundingClientRect();
        setPosition({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
        targetRef.current.classList.add('onboarding-highlight');
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('resize', updatePosition);
      if (targetRef.current) {
        targetRef.current.classList.remove('onboarding-highlight');
      }
    };
  }, [currentStep, step.target]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };
  
  const getTooltipPosition = () => {
    const offset = 12; // 12px offset from the target element
    switch (step.placement) {
      case 'bottom':
        return { top: position.top + position.height + offset, left: position.left + position.width / 2 };
      case 'top':
        return { top: position.top - offset, left: position.left + position.width / 2, transform: 'translate(-50%, -100%)' };
      case 'left':
        return { top: position.top + position.height / 2, left: position.left - offset, transform: 'translate(-100%, -50%)' };
      case 'right':
        return { top: position.top + position.height / 2, left: position.left + position.width + offset, transform: 'translate(0, -50%)' };
      default:
        return { top: position.top + position.height + offset, left: position.left + position.width / 2 };
    }
  };
  
  const tooltipStyle = {
    ...getTooltipPosition(),
    transform: step.placement === 'bottom' 
      ? 'translateX(-50%)' 
      : (getTooltipPosition() as any).transform || 'translateX(-50%)',
  };


  if (!targetRef.current) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 animate-fade-in-up">
      <style>{`
        .onboarding-highlight {
          position: relative;
          z-index: 51;
          border-radius: 0.75rem;
          box-shadow: 0 0 0 4px rgba(236, 72, 153, 0.7);
          transition: box-shadow 0.3s ease-in-out;
        }
      `}</style>
      <div
        className="absolute p-4 glass rounded-xl shadow-xl text-white max-w-xs animate-fade-in-up"
        style={tooltipStyle}
      >
        <p className="text-sm mb-4">{step.content}</p>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">{currentStep + 1} / {steps.length}</span>
          <div>
            {currentStep > 0 && (
              <button onClick={handlePrev} className="text-xs px-3 py-1 rounded-md hover:bg-white/10 transition-colors">
                Back
              </button>
            )}
            <button onClick={handleNext} className="text-sm font-semibold px-4 py-2 bg-emerald-500 rounded-lg hover:bg-emerald-600 transition-colors">
              {currentStep < steps.length - 1 ? 'Next' : 'Finish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};