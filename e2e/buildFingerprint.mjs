// Which production build a remote smoke run (--url) tested (#822). Vercel deploys are atomic: when `main` deploys
// mid-run, the old build's hashed chunks vanish and the rest of the run loads a stale or a different build. The smoke
// fingerprints index.html at the start and again when the run fails; a changed fingerprint makes the failure
// inconclusive (no single build tested) instead of red.

/** The smoke's exit code for that verdict; scripts/prod-alert.cjs `INCONCLUSIVE` must match (buildFingerprint.test.ts). */
export const INCONCLUSIVE_EXIT = 3

/** index.html's entry script and modulepreload paths (Vite's hashed names), or null when it has no entry script. */
export function buildFingerprint(html) {
  const entry = /<script\b[^>]*\btype="module"[^>]*\bsrc="([^"]+)"/.exec(html)?.[1]
  if (!entry) return null
  const preloads = [...html.matchAll(/<link\b[^>]*\brel="modulepreload"[^>]*\bhref="([^"]+)"/g)].map((m) => m[1]).sort()
  return { entry, preloads }
}

const fileName = (p) => p.slice(p.lastIndexOf('/') + 1)

/**
 * The plain-words verdict when the build changed between two fingerprints, else null. An unknown fingerprint (the
 * fetch failed) is never a change: the failure then stays red.
 */
export function redeployVerdict(before, after) {
  if (!before || !after) return null
  if (before.entry === after.entry && before.preloads.join() === after.preloads.join()) return null
  const change = before.entry === after.entry ? 'same entry, other preloaded chunks' : `${fileName(before.entry)} → ${fileName(after.entry)}`
  return `production redeployed mid-run (${change}): no single build tested`
}
