import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Bot } from 'lucide-react';

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
  // Realistic animated waveform for user speaking
  const numBars = 36;
  const seeds = useMemo(() => Array.from({ length: numBars }, () => Math.random() * Math.PI * 2), [numBars]);
  const [heights, setHeights] = useState<number[]>(() => Array.from({ length: numBars }, () => 12));
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!isUserSpeaking) {
      // Ease bars back to minimal when not speaking
      setHeights(Array.from({ length: numBars }, () => 10));
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const animate = (t: number) => {
      if (!startTimeRef.current) startTimeRef.current = t;
      const elapsed = (t - startTimeRef.current) / 1000; // seconds
      const center = (numBars - 1) / 2;

      const nextHeights = seeds.map((seed, i) => {
        const dist = Math.abs(i - center) / center; // 0 at center, 1 at edges
        const envelope = 0.25 + 0.75 * (1 - dist ** 2); // parabolic envelope
        const wobble = Math.sin(elapsed * 6 + seed * 2) * 0.5 + Math.sin(elapsed * 2.7 + seed) * 0.5; // layered
        const jitter = (Math.sin((elapsed + seed) * 14.3 + i) + 1) * 0.5; // fast micro jitter 0..1
        // Base height between 8-64px scaled by envelope and wobble/jitter
        const base = 8 + envelope * 56; // 8..64
        const variation = (0.35 + 0.65 * ((wobble + 1) / 2)) * (0.6 + 0.4 * jitter); // 0.21..1
        return Math.max(6, Math.min(68, base * variation));
      });

      setHeights(nextHeights);
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      startTimeRef.current = 0;
    };
  }, [isUserSpeaking, numBars, seeds]);
  return (
    <div className="relative flex items-center justify-center mb-8">
      {(isListening || isUserSpeaking || isAISpeaking) && (
        <>
          <div className="absolute w-56 h-56 rounded-full bg-pink-500/10 blur-2xl animate-pulse-ring" />
          <div className="absolute w-64 h-64 rounded-full border border-pink-400/30 animate-[ping_3s_ease-out_infinite]" />
        </>
      )}

      <div className="relative w-48 h-48 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-white/10 backdrop-blur-md shadow-2xl">
        {(isListening || isUserSpeaking || isAISpeaking) && (
          <div className="absolute inset-0 rounded-full ring-2 ring-pink-500/40 shadow-[0_0_40px_rgba(236,72,153,0.35)]" />
        )}

        {!isListening && !isUserSpeaking && !isAISpeaking && !isProcessing && (
          <div className="text-white/90 animate-float">
            <Bot size={56} />
          </div>
        )}

        {/* Center content by state */}
        {isUserSpeaking && (
          <div className="relative w-40 sm:w-44 md:w-48">
            <div className="mx-auto flex items-end justify-center gap-[3px]">
              {heights.map((h, i) => (
                <span
                  aria-hidden
                  key={i}
                  className="inline-block w-[3px] sm:w-[3px] md:w-[4px] rounded-full bg-gradient-to-t from-pink-400 via-fuchsia-400 to-sky-400 shadow-[0_0_10px_rgba(236,72,153,0.35)]"
                  style={{ height: `${h}px`, transition: 'height 90ms ease' }}
                />
              ))}
            </div>
            {/* subtle glow */}
            <div className="pointer-events-none absolute inset-x-6 -bottom-2 h-6 blur-2xl bg-pink-500/20" />
          </div>
        )}

        {isAISpeaking && !isUserSpeaking && (
          <div className="relative">
            <span className="absolute inset-0 rounded-full border border-emerald-400/40 animate-[ping_2.2s_ease-out_infinite]" />
            <span className="absolute inset-2 rounded-full border border-emerald-300/30 animate-[ping_2.2s_ease-out_infinite] [animation-delay:200ms]" />
            <span className="absolute inset-4 rounded-full border border-emerald-200/20 animate-[ping_2.2s_ease-out_infinite] [animation-delay:400ms]" />
            <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.6)]" />
          </div>
        )}

        {(isListening || isProcessing) && !isUserSpeaking && !isAISpeaking && (
          <div className={`mx-auto flex items-center justify-center rounded-full transition-all duration-300 ${
            isProcessing ? 'text-purple-400' : 'text-sky-400 drop-shadow-blue'
          }`}>
            <Mic size={56} />
          </div>
        )}

        {isProcessing && (
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex gap-1">
            <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
            <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:120ms]" />
            <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:240ms]" />
          </div>
        )}
      </div>
    </div>
  );
};