/**
 * How Vercel serves this static build from `vercel.json` (#193, #352): which file a path gets
 * and which headers come with it. Pure; `site.test.ts` checks the config against it and
 * `e2e/prod-check.mjs` checks the deployed site against it (and serves a local build by it).
 */

/** Vercel `source` patterns as used here: literal paths plus `(.*)` groups (path-to-regexp). */
export function sourceRegex(source) {
  if (!/^[\w/.-]*$/.test(source.replace(/\(\.\*\)/g, ''))) throw new Error(`unsupported vercel.json source: ${source}`)
  return new RegExp(`^${source.replace(/[.]/g, '\\.').replace(/\\\.\*/g, '.*')}$`)
}

/** Vercel's order for a static build: a file in the output, else the first matching rewrite, else 404.html with a 404. */
export function route(pathname, files, vercel) {
  const file = pathname === '/' ? '/index.html' : pathname
  if (files.has(file)) return { status: 200, serves: file }
  for (const { source, destination } of vercel.rewrites ?? []) {
    const match = pathname.match(sourceRegex(source))
    if (!match) continue
    const target = destination.replace(/\$(\d)/g, (_, i) => match[Number(i)])
    if (files.has(target)) return { status: 200, serves: target }
  }
  return { status: 404, serves: '/404.html' }
}

/** The headers vercel.json adds to a path (later rules win). */
export function headersFor(pathname, vercel) {
  const out = {}
  for (const rule of vercel.headers ?? []) {
    if (sourceRegex(rule.source).test(pathname)) for (const h of rule.headers) out[h.key] = h.value
  }
  return out
}
