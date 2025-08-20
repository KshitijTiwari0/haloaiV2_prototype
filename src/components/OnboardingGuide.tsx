import React, { useState, useEffect, useRef } from 'react';
import { OnboardingStep } from '../types';

interface OnboardingGuideProps {
  steps: OnboardingStep[];
  onClose: () => void;
}

export const OnboardingGuide: React.FC<OnboardingGuideProps> = ({ steps, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [style, setStyle] = useState<React.CSSProperties>({ opacity: 0 });
  const step = steps[currentStep];
  const targetRef = useRef<Element | null>(null);

  useEffect(() => {
    const updatePosition = () => {
      // Clear previous highlight
      if (targetRef.current) {
        targetRef.current.classList.remove('onboarding-highlight');
      }

      const targetElement = document.querySelector(step.target);
      targetRef.current = targetElement;

      if (targetElement) {
        const rect = targetElement.getBoundingClientRect();
        targetElement.classList.add('onboarding-highlight');

        const offset = 12;
        const tooltipMaxWidth = 320; // from max-w-xs class
        const viewportPadding = 16;
        
        const newStyle: React.CSSProperties = {
          opacity: 1,
          transition: 'top 0.3s ease, left 0.3s ease, opacity 0.3s ease',
        };

        switch (step.placement) {
          case 'bottom':
          default:
            newStyle.top = rect.top + rect.height + offset;
            let idealLeft = rect.left + rect.width / 2 - tooltipMaxWidth / 2;
            
            // Adjust to stay within viewport boundaries
            if (idealLeft + tooltipMaxWidth > window.innerWidth - viewportPadding) {
              idealLeft = window.innerWidth - tooltipMaxWidth - viewportPadding;
            }
            if (idealLeft < viewportPadding) {
              idealLeft = viewportPadding;
            }
            newStyle.left = idealLeft;
            break;
          // Other placements like 'top', 'left', 'right' can be added here
        }
        setStyle(newStyle);
      }
    };

    // Delay to ensure the target element is rendered and has its final dimensions
    const timeoutId = setTimeout(updatePosition, 100); 
    window.addEventListener('resize', updatePosition);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updatePosition);
      if (targetRef.current) {
        targetRef.current.classList.remove('onboarding-highlight');
      }
    };
  }, [currentStep, step.target, step.placement]);

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
        className="absolute p-4 glass rounded-xl shadow-xl text-white max-w-xs"
        style={style}
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