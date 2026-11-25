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
  // Every `define` vite.config.ts sets (declared in vite-env.d.ts), at a production build's value: a module that
  // reads one at top level (Crow.tsx's `__BLENDER_CROW__`) otherwise throws a ReferenceError when a test imports it.
  // scripts/viteDefines.test.ts fails a declared define missing here.
  define: {
    __BUILT_ON_VERCEL__: 'false',
    __PORTAL_BUILD__: 'false',
    __APP_VERSION__: JSON.stringify('test'),
    __BLENDER_CROW__: 'false',
  },
  test: {
    environment: 'node',
    // Fails a test that calls expect() too many times to stay fast on CI.
    setupFiles: ['scripts/vitestAssertionBudget.ts'],
    include: ['src/**/*.test.ts', 'api/**/*.test.ts', 'scripts/**/*.test.ts', 'e2e/**/*.test.ts'],
  },
})
