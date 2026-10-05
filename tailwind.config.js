/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        blue: {
          50: '#EEF3FC',
          500: '#2E6FE0',
          600: '#2558B8',
          700: '#1D4490',
        },
        ink: '#16233D',
        muted: '#5B6B85',
        bg: '#F4F6FA',
        surface: '#FFFFFF',
        border: '#E1E6EF',
        placeholder: '#9AA5B8',
        green: {
          50: '#E7F6ED',
          600: '#2E9E5B',
        },
        orange: {
          50: '#FEF3E2',
          500: '#F5A623',
          700: '#B45F17',
        },
        red: {
          50: '#FCE8E8',
          500: '#E5484D',
        },
        purple: {
          50: '#F3EEFE',
          600: '#7C3AED',
        },
        primary: {
          DEFAULT: '#2E6FE0',
          50: '#EEF3FC',
          500: '#2E6FE0',
          600: '#2558B8',
          700: '#1D4490',
        },
      },
      fontFamily: {
        sans: [
          'var(--font-noto-thai)',
          'var(--font-noto-sans)',
          'Noto Sans Thai',
          'Noto Sans',
          'system-ui',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}

