import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov', 'json-summary'],
      include: ['src/**/*.js'],
      exclude: ['bin/**', 'src/index.js'],
      thresholds: {
        lines: 98,
        statements: 98,
        functions: 97,
        branches: 92,
      },
    },
  },
});
