import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      include: ['src/orchestrator/**/*.ts', 'src/constants.ts'],
      exclude: ['src/index.tsx', 'src/ui/**'],
      thresholds: { lines: 85, branches: 80 },
    },
  },
})
