import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Legacy aliases kept for backward compat
        background: '#09090B',
        surface: '#18181B',
        primary: '#7DD3FC',
        warning: '#F59E0B',
        danger: '#EF4444',
        // New design system
        'surface-0': '#09090B',
        'surface-1': '#111827',
        'surface-2': '#18181B',
        'surface-3': '#27272A',
        'accent-blue': '#7DD3FC',
        'accent-blue-dim': '#38BDF8',
        'accent-sage': '#A7C4A0',
        'night-bg': '#0A0404',
        'night-surface': '#160808',
        'night-border': '#3B0D0D',
        'night-accent': '#FF4D4D',
        live: '#EF4444',
      },
      fontFamily: {
        sans: ['var(--font-inter)', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['var(--font-inter)', 'SF Mono', 'Menlo', 'monospace'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      transitionDuration: {
        '400': '400ms',
        '600': '600ms',
        '800': '800ms',
      },
      transitionTimingFunction: {
        'expo-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      backdropBlur: {
        '2xl': '40px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}

export default config
