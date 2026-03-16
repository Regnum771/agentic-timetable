/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['"DM Sans"', 'sans-serif'],
        body: ['"IBM Plex Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        surface: {
          50: '#f8f9fc',
          100: '#f0f2f7',
          200: '#e2e6ef',
          300: '#c8cfe0',
          400: '#9aa5bd',
          500: '#6b7a99',
          600: '#4a5568',
          700: '#2d3748',
          800: '#1a202c',
          900: '#0f1318',
        },
        accent: {
          DEFAULT: '#3b82f6',
          hover: '#2563eb',
          muted: '#93c5fd',
          subtle: '#dbeafe',
        },
        status: {
          info: '#3b82f6',
          warning: '#f59e0b',
          critical: '#ef4444',
          success: '#10b981',
        }
      },
      animation: {
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'slide-in': 'slide-in 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'slide-in': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
