/**
 * Pure rules of the deploy health check (`e2e/prod-check.mjs`, #352): which files the deployed
 * build must serve, and what each response must look like. Unit-tested in prodCheckRules.test.ts.
 */
import { headersFor } from './vercelRoutes.mjs'

/** Vite's `[name]-[hash].[ext]` file name without its 8-character hash: `tone-BAgUArOt.js` → `tone.js`. */
export function assetStem(file) {
  const base = file.split('/').pop()
  const m = base.match(/^(.+)-[\w-]{8}(\.\w+)$/)
  return m ? m[1] + m[2] : base
}

/** Site paths a page, stylesheet or chunk points at: `/assets/…`, `assets/…` (Vite's dep map) and `/fonts/…`. */
export function assetRefs(text) {
  const refs = new Set()
  for (const m of text.matchAll(/(?<![\w/.-])\/?((?:assets|fonts)\/[\w.-]+\.(?:js|css|woff2?|png|jpe?g|svg|webp|wasm|json))/g)) {
    refs.add(`/${m[1]}`)
  }
  return refs
}

/**
 * Hashed files of the local build that the deployed build lacks, matched by stem (the deployed
 * hashes can differ: Vercel builds with its own env). Counts matter, so two `index.js` stay two.
 */
export function missingAssets(localAssets, deployedAssets) {
  const have = new Map()
  for (const p of deployedAssets) have.set(assetStem(p), (have.get(assetStem(p)) ?? 0) + 1)
  const missing = []
  for (const p of localAssets) {
    const n = have.get(assetStem(p)) ?? 0
    if (n > 0) have.set(assetStem(p), n - 1)
    else missing.push(p)
  }
  return missing
}

const CONTENT_TYPES = {
  '.html': /text\/html/,
  '.js': /javascript/,
  '.css': /text\/css/,
  '.woff2': /font\/woff2|application\/(font-woff2|octet-stream)/,
  '.json': /json/,
  '.webmanifest': /manifest\+json|json/,
  '.png': /image\/png/,
  '.jpg': /image\/jpeg/,
  '.svg': /image\/svg\+xml/,
  '.ico': /image\/(x-icon|vnd\.microsoft\.icon)/,
  '.txt': /text\/plain/,
  '.xml': /xml/,
}

/** One unhashed file cached for a day or more outlives the deploy that replaces it. */
const LONG_CACHE_S = 86400

/**
 * What is wrong with one response for `pathname`: its status, its content type (a chunk answered with
 * HTML is the classic broken deploy), the headers vercel.json promises, and no long cache off `/assets/`.
 * `headers` is a lower-cased header map.
 */
export function responseProblems(pathname, { status, headers, bytes }, vercel, wantStatus = 200) {
  const problems = []
  if (status !== wantStatus) return [`${pathname}: HTTP ${status} (want ${wantStatus})`]
  if (wantStatus === 200 && !bytes) problems.push(`${pathname}: empty body`)
  const ext = pathname.match(/\.\w+$/)?.[0] ?? '.html'
  const type = headers['content-type'] ?? ''
  if (CONTENT_TYPES[ext] && !CONTENT_TYPES[ext].test(type)) problems.push(`${pathname}: content-type "${type}"`)
  const expected = headersFor(pathname, vercel)
  for (const [key, value] of Object.entries(expected)) {
    if (headers[key.toLowerCase()] !== value) problems.push(`${pathname}: ${key} "${headers[key.toLowerCase()] ?? ''}" (want "${value}")`)
  }
  if (!Object.keys(expected).some((k) => k.toLowerCase() === 'cache-control')) {
    const cache = headers['cache-control'] ?? ''
    const maxAge = Number(cache.match(/(?:^|[\s,])max-age=(\d+)/)?.[1] ?? 0)
    if (/immutable/.test(cache) || maxAge >= LONG_CACHE_S) problems.push(`${pathname}: unhashed file cached long ("${cache}")`)
  }
  return problems
}
