import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    chaiConfig: {
      truncateThreshold: 100000,
    },
    maxConcurrency: 3,
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
})
