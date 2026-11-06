/** Pure rules of the deploy health check (`e2e/prod-check.mjs`, #352). */
import { headersFor } from './vercelRoutes.mjs'

/** `tone-BAgUArOt.js` → `tone.js` (Vite's `[name]-[hash]`). */
export function assetStem(file) {
  const base = file.split('/').pop()
  const m = base.match(/^(.+)-[\w-]{8}(\.\w+)$/)
  return m ? m[1] + m[2] : base
}

/** `assets/…` without a leading slash is Vite's dep map. */
export function assetRefs(text) {
  const refs = new Set()
  for (const m of text.matchAll(/(?<![\w/.-])\/?((?:assets|fonts)\/[\w.-]+\.(?:js|css|woff2?|png|jpe?g|svg|webp|wasm|json))/g)) {
    refs.add(`/${m[1]}`)
  }
  return refs
}

/** Matched by stem, since Vercel's build env can change the hashes. */
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

/**
 * GET /api/leaderboard (#365): the top 10 (CDN-cached), or a bare uncached 503 while the board is
 * unavailable (no env vars yet, a paused Supabase project). Never a 500, a 404 or anything that leaks.
 */
export function leaderboardApiProblems({ status, headers, body }, vercel) {
  const where = '/api/leaderboard'
  if (status !== 200 && status !== 503) return [`${where}: HTTP ${status} (want 200, or 503 while the board is unavailable)`]
  const problems = []
  if (!/application\/json/.test(headers['content-type'] ?? '')) problems.push(`${where}: content-type "${headers['content-type'] ?? ''}"`)
  for (const [key, value] of Object.entries(headersFor(where, vercel))) {
    if (headers[key.toLowerCase()] !== value) problems.push(`${where}: ${key} "${headers[key.toLowerCase()] ?? ''}" (want "${value}")`)
  }
  const text = body.toString()
  if (/supabase|sb_secret|postgres|\bat \S+:\d+/i.test(text)) problems.push(`${where}: the response leaks server details`)
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    return [...problems, `${where}: not JSON`]
  }
  const cache = headers['cache-control'] ?? ''
  if (status === 200) {
    if (!Array.isArray(json?.top)) problems.push(`${where}: no top list`)
    if (!/s-maxage=\d+/.test(cache)) problems.push(`${where}: not CDN-cached ("${cache}")`)
  } else {
    if (json?.error !== 'unavailable') problems.push(`${where}: 503 body ${text.slice(0, 80)}`)
    if (/s-maxage|immutable/.test(cache)) problems.push(`${where}: 503 cached ("${cache}")`)
  }
  return problems
}

/** One unhashed file cached for a day or more outlives the deploy that replaces it. */
const LONG_CACHE_S = 86400

/** `headers` is lower-cased; a chunk answered with HTML (wrong content type) is the classic broken deploy. */
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
