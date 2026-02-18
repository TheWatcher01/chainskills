import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/index.ts', 'src/infrastructure/**'],
    },
  },
  resolve: {
    alias: {
      '#core/': './src/core/',
      '#adapters/': './src/adapters/',
      '#cli/': './src/cli/',
      '#config/': './src/config/',
      '#infra/': './src/infrastructure/',
    },
  },
});
