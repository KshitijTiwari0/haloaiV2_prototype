import React from 'react';

interface BackgroundFXProps {
  intensity?: number; // number of particles
}

export const BackgroundFX: React.FC<BackgroundFXProps> = ({ intensity = 24 }) => {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      {/* Animated gradient backdrop */}
      <div className="absolute inset-0 bg-aurora animate-gradient-slow" />

      {/* Subtle vignette */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_0%,transparent_60%,rgba(0,0,0,0.5)_100%)]" />

      {/* Particles */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: intensity }).map((_, i) => {
          const size = Math.random() * 3 + 1; // 1 - 4px
          const left = Math.random() * 100;
          const top = Math.random() * 100;
          const delay = Math.random() * 4; // 0 - 4s
          const duration = 6 + Math.random() * 6; // 6 - 12s
          const opacity = 0.15 + Math.random() * 0.25; // 0.15 - 0.4
          return (
            <span
              key={i}
              className="absolute rounded-full bg-white/70 blur-[1px] animate-float"
              style={{
                width: `${size}px`,
                height: `${size}px`,
                left: `${left}%`,
                top: `${top}%`,
                animationDelay: `${delay}s`,
                animationDuration: `${duration}s`,
                opacity,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

export default BackgroundFX;


