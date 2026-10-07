import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // The API writes its database and uploads inside the project; never reload the browser for those.
    watch: { ignored: ['**/data/**', '**/uploads/**', '**/dist/**'] },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'motion/react', 'lucide-react', 'canvas-confetti'],
  },
  build: { chunkSizeWarningLimit: 1400 },
});
