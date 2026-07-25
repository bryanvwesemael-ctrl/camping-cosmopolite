/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        green: {
          DEFAULT: '#1B8A5B',
          primary: '#1B8A5B',
          dark: '#0D5035',
          soft: '#E6F3EC',
        },
        amber: { DEFAULT: '#C77A11', soft: '#FBEFD9' },
        canvas: '#FAFAF7',
        ink: '#202124',
        muted: '#5B6470',
        hairline: '#E9EAE4',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        head: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
      },
      maxWidth: { content: '1180px' },
      borderRadius: { xl2: '20px', xl3: '28px' },
      boxShadow: {
        soft: '0 4px 24px -8px rgba(16,32,24,.12)',
        card: '0 2px 14px -6px rgba(16,32,24,.14)',
        lift: '0 18px 44px -18px rgba(16,32,24,.30)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(16px)' }, '100%': { opacity: '1', transform: 'none' } },
      },
      animation: { 'fade-up': 'fade-up .6s ease both' },
    },
  },
  plugins: [],
};
