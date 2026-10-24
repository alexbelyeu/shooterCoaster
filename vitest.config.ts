import { defineConfig } from 'vitest/config'
import path from 'path'

// Unit tests for pure modules only: plain Node, no DOM, no WebGL.
// Rendering and gameplay are covered by the headless smoke test (`npm run smoke`).
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
