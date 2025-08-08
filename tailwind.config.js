/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      keyframes: {
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', boxShadow: '0 0 0 0 rgba(236,72,153,0.6)' },
          '70%': { transform: 'scale(1.1)', boxShadow: '0 0 0 14px rgba(236,72,153,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(236,72,153,0)' },
        },
        wave: {
          '0%': { transform: 'scaleY(0.4)' },
          '50%': { transform: 'scaleY(1)' },
          '100%': { transform: 'scaleY(0.4)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'gradient-slow': 'gradient 18s ease infinite',
        float: 'float 6s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 2.5s cubic-bezier(0,0,0.2,1) infinite',
        wave: 'wave 1s ease-in-out infinite',
        'fade-in-up': 'fade-in-up 600ms ease forwards',
      },
      backgroundSize: {
        '300%': '300% 300%',
      },
      dropShadow: {
        pink: '0 0 10px rgba(236, 72, 153, 0.65)',
        blue: '0 0 8px rgba(59, 130, 246, 0.65)',
      },
    },
  },
  plugins: [],
};
