import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    include: ['src/**/*.test.ts', 'src/**/*.e2e.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/orchestrator/**/*.ts', 'src/constants.ts'],
      exclude: ['src/index.tsx', 'src/ui/**', 'src/e2e/**'],
      thresholds: { lines: 85, branches: 80 },
    },
  },
})
