/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand Color Tokens
        bg: '#0B1020',
        card: '#121A2B', 
        line: '#1F2A3D',
        text: '#ECF1F8',
        muted: '#9FB0C8',
        primary: '#5B8CFF',
        positive: '#22C55E',
        warn: '#F59E0B',
        
        // Semantic mappings
        background: '#0B1020',
        foreground: '#ECF1F8',
        
        border: '#1F2A3D',
        input: '#121A2B',
        ring: '#5B8CFF',
        
        destructive: {
          DEFAULT: '#EF4444',
          foreground: '#ECF1F8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans JP', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'body': ['14px', { lineHeight: '1.5' }],
        'body-lg': ['16px', { lineHeight: '1.5' }],
        'heading-sm': ['20px', { lineHeight: '1.3' }],
        'heading-md': ['24px', { lineHeight: '1.25' }],
        'heading-lg': ['28px', { lineHeight: '1.2' }],
      },
      spacing: {
        // 8px grid system
        '0.5': '2px',
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '8': '32px',
        '10': '40px',
        '12': '48px',
        '16': '64px',
        '20': '80px',
      },
      borderRadius: {
        'lg': '12px',
        'xl': '16px',
        '2xl': '20px',
        '3xl': '24px',
      },
      boxShadow: {
        'card': '0 2px 8px 0 rgba(0, 0, 0, 0.12)',
      },
    },
  },
  plugins: [],
}