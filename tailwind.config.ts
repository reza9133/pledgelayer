import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#07080B',
          900: '#0A0C10',
          800: '#111319',
          700: '#171A22',
          600: '#20242E',
          500: '#2B303C',
        },
        paper: {
          100: '#F3F1E9',
          200: '#E8E5D8',
          300: '#C9C6B8',
          400: '#8A8F9C',
        },
        brass: {
          300: '#E4C766',
          400: '#D4B24C',
          500: '#C9A227',
          600: '#A9840F',
        },
        verdict: {
          approve: '#3FBE7C',
          approveDim: '#1F3A2C',
          reject: '#D9605C',
          rejectDim: '#3A2323',
          pending: '#8A8F9C',
        },
      },
      fontFamily: {
        display: ['var(--font-fraunces)', 'ui-serif', 'Georgia', 'serif'],
        body: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      backgroundImage: {
        grain: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E\")",
      },
      boxShadow: {
        stamp: '0 0 0 1px rgba(201,162,39,0.35), 0 8px 24px -8px rgba(0,0,0,0.6)',
      },
      keyframes: {
        stampdown: {
          '0%': { transform: 'scale(2.4) rotate(-14deg)', opacity: '0' },
          '60%': { transform: 'scale(0.94) rotate(-6deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(-6deg)', opacity: '1' },
        },
        fadeUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        stampdown: 'stampdown 0.45s cubic-bezier(.2,.8,.3,1.1) both',
        fadeUp: 'fadeUp 0.4s ease both',
      },
    },
  },
  plugins: [],
};

export default config;
