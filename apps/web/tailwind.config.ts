import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        brand: {
          50: '#f8f9fa',
          100: '#e9ecef',
          600: '#6c757d',
          700: '#495057',
          900: '#212529',
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 2.2s ease-in-out infinite',
        'slide-right': 'slideInFromRight 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        'check-pop': 'checkPop 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'fade-in': 'fadeSlideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
};

export default config;
