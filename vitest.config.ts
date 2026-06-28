import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./apps/desktop/src/renderer/test-setup.ts'],
    include: ['apps/desktop/src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
});

