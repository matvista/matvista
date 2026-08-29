/// <reference types="vitest/config" />
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
  test: {
    // Process CSS imported by tests instead of stubbing it out. The
    // auto-rotate behaviour test needs the real stylesheet in the document:
    // a control that is present, labelled and correctly wired but hidden by a
    // CSS rule still fails WCAG 2.2.2, and that is invisible to every
    // source-level assertion. Only files that import CSS pay for this.
    css: true,
  },
});
