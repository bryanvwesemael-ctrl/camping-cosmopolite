import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite-config voor de premium website. Manuele chunk-splitsing houdt de
// initiële bundel klein (React/router/animaties apart) → betere Lighthouse-score.
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
