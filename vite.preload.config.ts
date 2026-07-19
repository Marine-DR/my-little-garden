import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'apps/desktop/src/preload/preload.ts'),
      formats: ['cjs'],
      fileName: () => 'preload.js',
    },
    outDir: resolve(__dirname, 'dist/main/preload'),
    rollupOptions: {
      external: ['electron'],
    },
  },
});
