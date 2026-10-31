import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Portal pages carry their own share card, canonical URL and structured data, and the zip may
 * not point at another origin: drop those tags, the web app manifest (scoaster.com's) and the
 * VideoGame JSON-LD. The #about text stays.
 */
function portalHtml(): Plugin {
  return {
    name: 'portal-html',
    transformIndexHtml: (html) =>
      html
        .replace(/^\s*(<!-- Share card[^\n]*|<link rel="(canonical|manifest)"[^\n]*|<meta (property="og:|name="twitter:)[^\n]*)\n/gm, '')
        .replace(/^\s*<script type="application\/ld\+json">[\s\S]*?<\/script>\n/m, ''),
  }
}

// `vite build --mode portal` (`npm run build:portal`): relative asset URLs, so the zip plays from any sub-path.
export default defineConfig(({ mode }) => {
  const portal = mode === 'portal'
  return {
    base: portal ? './' : '/',
    plugins: portal ? [react(), portalHtml()] : [react()],
    define: {
      // Vercel sets VERCEL=1 during its builds; gates Web Analytics (src/app/analyticsGate.ts). Portal builds never send it.
      __BUILT_ON_VERCEL__: JSON.stringify(process.env.VERCEL === '1' && !portal),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      outDir: portal ? 'dist-portal' : 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            three: ['three'],
            r3f: ['@react-three/fiber', '@react-three/drei'],
          },
        },
      },
    },
  }
})
