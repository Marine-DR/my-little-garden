import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'apps/desktop/src/renderer'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./apps/desktop/tests/test-setup.ts'],
    include: ['apps/desktop/tests/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
});
