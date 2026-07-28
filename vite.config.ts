import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' makes the production build run straight from the filesystem —
// open dist/index.html by double-clicking it, no server needed, fully offline.
// Port is pinned so every launch path agrees: 5173 for MatVista, 5174 for Recall.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
});
