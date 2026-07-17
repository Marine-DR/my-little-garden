import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname, 'apps/desktop'),
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'apps/desktop/src/renderer'),
    },
  },
  build: { outDir: resolve(__dirname, 'dist/renderer'), emptyOutDir: true },
});
