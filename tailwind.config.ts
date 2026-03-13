import type { Config } from 'tailwindcss';

export default {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0c0c14',
          secondary: '#12121e',
          card: '#191926',
          hover: '#1f1f30',
          elevated: '#21213a',
        },
        ink: {
          DEFAULT: '#f0f0ff',
          secondary: '#8888a8',
          muted: '#55556a',
          faint: '#2d2d42',
        },
        edge: {
          DEFAULT: '#2a2a3d',
          bright: '#3a3a52',
        },
        accent: {
          DEFAULT: '#6366f1',
          hover: '#4f52d9',
          subtle: 'rgba(99,102,241,0.15)',
        },
        success: {
          DEFAULT: '#22c55e',
          subtle: 'rgba(34,197,94,0.15)',
        },
        warn: {
          DEFAULT: '#f59e0b',
          subtle: 'rgba(245,158,11,0.15)',
        },
        danger: {
          DEFAULT: '#ef4444',
          subtle: 'rgba(239,68,68,0.15)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)',
        glow: '0 0 20px rgba(99,102,241,0.2)',
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
        'slide-in-right': 'slideInRight 0.2s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
