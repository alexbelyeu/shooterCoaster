/** How Vercel serves this static build and its functions from `vercel.json` (site.test.ts, e2e/prod-check.mjs). */

/** Vercel `source` patterns as used here: literal paths plus `(.*)` groups (path-to-regexp). */
export function sourceRegex(source) {
  if (!/^[\w/.-]*$/.test(source.replace(/\(\.\*\)/g, ''))) throw new Error(`unsupported vercel.json source: ${source}`)
  return new RegExp(`^${source.replace(/[.]/g, '\\.').replace(/\\\.\*/g, '.*')}$`)
}

/** `/api/leaderboard` → `api/leaderboard.ts`, for every function vercel.json lists (site.test.ts checks it lists them all). */
export function functionPaths(vercel) {
  return new Map(Object.keys(vercel.functions ?? {}).map((file) => ['/' + file.replace(/\.[cm]?[jt]s$/, ''), file]))
}

/**
 * Vercel's order: a file in the output or a function under api/, else the first matching rewrite, else 404.html
 * with a 404. A function route is `{ fn }`: the function picks its own status.
 */
export function route(pathname, files, vercel) {
  const file = pathname === '/' ? '/index.html' : pathname
  if (files.has(file)) return { status: 200, serves: file }
  const fn = functionPaths(vercel).get(pathname)
  if (fn) return { fn }
  for (const { source, destination } of vercel.rewrites ?? []) {
    const match = pathname.match(sourceRegex(source))
    if (!match) continue
    const target = destination.replace(/\$(\d)/g, (_, i) => match[Number(i)])
    if (files.has(target)) return { status: 200, serves: target }
  }
  return { status: 404, serves: '/404.html' }
}

export function headersFor(pathname, vercel) {
  const out = {}
  for (const rule of vercel.headers ?? []) {
    if (sourceRegex(rule.source).test(pathname)) for (const h of rule.headers) out[h.key] = h.value
  }
  return out
}
