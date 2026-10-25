import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 60000, // mongodb-memory-server needs time to spin up
    hookTimeout: 60000,
    reporters: ['verbose'],
  },
});
