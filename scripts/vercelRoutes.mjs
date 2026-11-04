/** How Vercel serves this static build from `vercel.json` (site.test.ts, e2e/prod-check.mjs). */

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

export function headersFor(pathname, vercel) {
  const out = {}
  for (const rule of vercel.headers ?? []) {
    if (sourceRegex(rule.source).test(pathname)) for (const h of rule.headers) out[h.key] = h.value
  }
  return out
}
