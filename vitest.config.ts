import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./apps/desktop/tests/test-setup.ts'],
    include: ['apps/desktop/tests/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
});
