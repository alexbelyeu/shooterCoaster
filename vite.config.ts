import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import { createHash } from 'crypto'
import { build as esbuild } from 'esbuild'
import { minifyGlsl } from './scripts/glslMinify.mjs'
import { stripScrim } from './scripts/scrimStrip.mjs'
import { manifestLine, precacheList } from './scripts/swPrecache.mjs'

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

/** Level 6's track puts Alex's gym blockout in the startup JS: drop his notes on import, leaving his file as he wrote it (#544). */
function stripBlockoutNotes(): Plugin {
  return {
    name: 'strip-blockout-notes',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('/gym/blockout.json')) return null
      return { code: JSON.stringify(JSON.parse(code), (key, value) => (key === 'note' || key === 'notes' ? undefined : value)), map: null }
    },
  }
}

// Strips the comments and indentation from the shaders' glsl-tagged source in builds (scripts/glslMinify.mjs).
function minifyGlslPlugin(): Plugin {
  return {
    name: 'minify-glsl',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      if (!/\/src\/.*\.tsx?$/.test(id) || !code.includes('/* glsl */')) return null
      return { code: minifyGlsl(code), map: null }
    },
  }
}

// Ships the music scores (`*.scrim?raw`) without their comments and `about` prose in builds (scripts/scrimStrip.mjs).
function stripScrimNotesPlugin(): Plugin {
  return {
    name: 'strip-scrim-notes',
    apply: 'build',
    enforce: 'pre',
    load(id) {
      if (!id.endsWith('.scrim?raw')) return null
      return `export default ${JSON.stringify(stripScrim(fs.readFileSync(id.slice(0, -'?raw'.length), 'utf8')))}`
    },
  }
}

/** Writes `sw.js` (#999): `src/sw/sw.ts` bundled under the line naming what it precaches (`scripts/swPrecache.mjs`). */
function serviceWorker(): Plugin {
  let publicDir = ''
  return {
    name: 'service-worker',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      publicDir = config.publicDir
    },
    async generateBundle(_, bundle) {
      const contents = new Map<string, string | Uint8Array>()
      for (const out of Object.values(bundle)) contents.set('/' + out.fileName, out.type === 'chunk' ? out.code : out.source)
      for (const d of fs.readdirSync(publicDir, { recursive: true, withFileTypes: true })) {
        if (d.isFile()) contents.set('/' + path.relative(publicDir, path.join(d.parentPath, d.name)).split(path.sep).join('/'), fs.readFileSync(path.join(d.parentPath, d.name)))
      }
      const files = precacheList(contents.keys())
      const digest = createHash('sha256')
      for (const f of files) digest.update(f).update(contents.get(f)!)
      const { outputFiles } = await esbuild({
        entryPoints: [path.resolve(__dirname, 'src/sw/sw.ts')],
        bundle: true,
        write: false,
        minify: true,
        format: 'iife',
        target: 'es2020',
      })
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: manifestLine(files, `sc-${digest.digest('hex').slice(0, 16)}`) + outputFiles[0].text })
    },
  }
}

// `vite build --mode portal` (`npm run build:portal`): relative asset URLs, so the zip plays from any sub-path.
// `vite build --mode turntable` (`npm run turntable`): only the dev pages (the enemy turntable, the ride elements), into dist-turntable/.
export default defineConfig(({ mode }) => {
  const portal = mode === 'portal'
  const turntable = mode === 'turntable'
  const { version } = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'))
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
  return {
    base: portal ? './' : '/',
    plugins: [react(), stripBlockoutNotes(), minifyGlslPlugin(), stripScrimNotesPlugin(), portal ? portalHtml() : turntable ? [] : serviceWorker()],
    define: {
      // Vercel sets VERCEL=1 during its builds; gates Web Analytics (src/app/analyticsGate.ts). Portal builds never send it.
      __BUILT_ON_VERCEL__: JSON.stringify(process.env.VERCEL === '1' && !portal),
      // The portal zip has no results Share: its scoaster.com link would take the portal's players off it (#254).
      __PORTAL_BUILD__: JSON.stringify(portal),
      // Sent with online leaderboard scores (`client_version`, #365).
      __APP_VERSION__: JSON.stringify(commit ? `${version}+${commit}` : version),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      outDir: portal ? 'dist-portal' : turntable ? 'dist-turntable' : 'dist',
      // Vite's default floor (Chrome 87, Firefox 78, Safari 14) has esbuild lower every `?.` (a Chrome 87-90 V8 bug) and
      // class fields (Firefox 78, Safari 14). Mid-2021 browsers ship both natively: ~1.7 KB gz less JS (#834, DECISIONS).
      target: ['es2020', 'chrome91', 'edge91', 'firefox90', 'safari15'],
      sourcemap: false,
      rollupOptions: {
        ...(turntable && { input: [path.resolve(__dirname, 'turntable.html'), path.resolve(__dirname, 'rides.html')] }),
        output: {
          // A world's chunk (#862, `levels/environments/worlds.ts`) is named after its biome: `world-desert-<hash>.js`.
          chunkFileNames: (chunk) => {
            const biome = /\/biomes\/(\w+)\/world\.ts$/.exec(chunk.facadeModuleId ?? '')?.[1]
            return biome ? `assets/world-${biome}-[hash].js` : 'assets/[name]-[hash].js'
          },
          manualChunks: {
            three: ['three'],
            r3f: ['@react-three/fiber', '@react-three/drei'],
          },
        },
      },
    },
  }
})
