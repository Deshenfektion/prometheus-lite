import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/tests/setup.ts'],
    testTimeout: 15_000,
    hookTimeout: 20_000,
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      BCRYPT_ROUNDS: '4',
    },
  },
});
