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
      // Raised as the suite grew. They are floors rather than targets: the
      // point is that a change which drops coverage fails rather than being
      // noticed six weeks later.
      thresholds: {
        lines: 99,
        statements: 99,
        functions: 99,
        branches: 92.5,
      },
    },
  },
});
