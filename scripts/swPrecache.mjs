/** What the service worker (#999, `src/sw/sw.ts`) precaches, and the first line of `sw.js` that carries it (`vite.config.ts` writes it, `e2e/prod-check.mjs` reads it). */

const PRECACHED_PUBLIC = /^\/(?:index\.html|site\.webmanifest|favicon\.(?:svg|ico)|apple-touch-icon\.png|poster\/[\w-]+\.webp|fonts\/[\w-]+\.woff2|icons\/[\w-]+\.png)$/

/** @param {Iterable<string>} files every output path, root-relative (`/assets/index-Ab12.js`); sorted, so the list depends only on the build */
export function precacheList(files) {
  return [...files].filter((f) => f.startsWith('/assets/') || PRECACHED_PUBLIC.test(f)).sort()
}

const MANIFEST_LINE = /^const SC_PRECACHE=(\[[^\n]*\]),SC_CACHE=("[^"\n]*");\n/

/**
 * The cache name is a digest of the precached files' contents, so any deploy changes the worker's bytes and browsers install it.
 * @param {string[]} files
 * @param {string} cache
 */
export const manifestLine = (files, cache) => `const SC_PRECACHE=${JSON.stringify(files)},SC_CACHE=${JSON.stringify(cache)};\n`

/**
 * @param {string} swSource
 * @returns {{ files: string[], cache: string } | null}
 */
export function readManifest(swSource) {
  const m = MANIFEST_LINE.exec(swSource)
  return m ? { files: JSON.parse(m[1]), cache: JSON.parse(m[2]) } : null
}
