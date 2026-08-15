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
      '@my-little-garden/core': resolve(
        __dirname,
        'packages/core/src/index.ts',
      ),
    },
  },
  build: { outDir: resolve(__dirname, 'dist/renderer'), emptyOutDir: true },
});
