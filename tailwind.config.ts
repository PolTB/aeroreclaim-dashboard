import type { Config } from 'tailwindcss';

/**
 * Los colores se definen como canales RGB en variables CSS (ver globals.css)
 * y se exponen aquí con `<alpha-value>`, de modo que todas las utilidades con
 * opacidad del código —`border-edge/60`, `bg-accent/10`— siguen funcionando
 * igual, pero ahora responden al tema claro/oscuro. Antes el modo claro sólo
 * cambiaba el fondo del body: las tarjetas seguían siendo oscuras y el texto
 * gris sobre blanco era ilegible.
 */
const rgb = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT:   rgb('--surface'),
          secondary: rgb('--surface-secondary'),
          card:      rgb('--surface-card'),
          hover:     rgb('--surface-hover'),
          elevated:  rgb('--surface-elevated'),
        },
        ink: {
          DEFAULT:   rgb('--ink'),
          secondary: rgb('--ink-secondary'),
          muted:     rgb('--ink-muted'),
          faint:     rgb('--ink-faint'),
        },
        edge: {
          DEFAULT: rgb('--edge'),
          bright:  rgb('--edge-bright'),
        },
        accent: {
          DEFAULT: rgb('--accent'),
          hover:   rgb('--accent-hover'),
          subtle:  'rgb(var(--accent) / 0.15)',
        },
        success: {
          DEFAULT: rgb('--success'),
          subtle:  'rgb(var(--success) / 0.15)',
        },
        warn: {
          DEFAULT: rgb('--warn'),
          subtle:  'rgb(var(--warn) / 0.15)',
        },
        danger: {
          DEFAULT: rgb('--danger'),
          subtle:  'rgb(var(--danger) / 0.15)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(var(--shadow) / 0.06), 0 0 0 1px rgb(var(--edge) / 0.5)',
        lift: '0 6px 20px -6px rgb(var(--shadow) / 0.25)',
        glow: '0 0 20px rgb(var(--accent) / 0.2)',
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
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
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
