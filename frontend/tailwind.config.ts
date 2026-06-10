import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Core dark backgrounds
        navy: {
          950: '#050a14',
          900: '#0a0f1a',
          800: '#0f1623',
          700: '#141d2e',
          600: '#1a2538',
          500: '#1f2d42',
        },
        // Teal/Cyan accent (from mockups)
        accent: {
          DEFAULT: '#00e5a0',
          50: '#eafff7',
          100: '#c5ffe9',
          200: '#8effd6',
          300: '#4dffc0',
          400: '#00e5a0',
          500: '#00c98a',
          600: '#00a672',
          700: '#008259',
          800: '#006647',
          900: '#005039',
        },
        // Card/surface colors
        card: {
          DEFAULT: '#111827',
          hover: '#162032',
          border: '#1e293b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(0, 229, 160, 0.2)' },
          '50%': { boxShadow: '0 0 20px rgba(0, 229, 160, 0.4)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
