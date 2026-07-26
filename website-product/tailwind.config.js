/** @type {import('tailwindcss').Config} */
// Kleuren en lettertypes komen uit CSS-variabelen, die per klant-site at
// runtime gezet worden (uit wb_sites.branding). Zo rendert één codebase elk merk.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'var(--brand-primary)',
          dark: 'var(--brand-dark)',
          accent: 'var(--brand-accent)',
          soft: 'var(--brand-soft)',
        },
        canvas: 'var(--brand-bg)',
        ink: 'var(--brand-ink)',
        muted: 'var(--brand-muted)',
        hairline: 'var(--brand-hairline)',
      },
      fontFamily: {
        head: ['var(--font-head)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      maxWidth: { content: '1180px' },
      borderRadius: { xl2: '20px', xl3: '28px' },
      boxShadow: {
        card: '0 2px 14px -6px rgba(16,24,32,.14)',
        lift: '0 18px 44px -18px rgba(16,24,32,.30)',
      },
    },
  },
  plugins: [],
};
