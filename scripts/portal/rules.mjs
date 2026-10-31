/** What itch.io, Newgrounds and CrazyGames accept in an HTML5 zip (itch.io's limits are the tightest). */

export const MAX_FILES = 1000
export const MAX_BYTES = 500 * 1024 * 1024

const THIRD_PARTY = /googleapis|gstatic|googletagmanager|google-analytics/

const ABSOLUTE_REF = /\b(?:src|href)\s*=\s*["']?\/|url\(\s*["']?\//
const OTHER_ORIGIN = /https?:\/\//

/** @param {{ path: string, bytes: number, text?: string }[]} files  paths relative to the zip root; `text` for text files */
export function portalProblems(files) {
  const problems = []
  if (!files.some((f) => f.path === 'index.html')) problems.push('no index.html at the root')
  if (files.length > MAX_FILES) problems.push(`${files.length} files (limit ${MAX_FILES})`)
  const bytes = files.reduce((sum, f) => sum + f.bytes, 0)
  if (bytes > MAX_BYTES) problems.push(`${(bytes / 1024 / 1024).toFixed(0)} MB (limit ${MAX_BYTES / 1024 / 1024} MB)`)
  for (const f of files) {
    if (f.text === undefined) continue
    if (THIRD_PARTY.test(f.text)) problems.push(`${f.path}: references ${f.text.match(THIRD_PARTY)[0]}`)
    // JS carries harmless URL strings (React error links, the GitHub link on the title); markup and styles may not.
    if (!/\.(html|css)$/.test(f.path)) continue
    const absolute = f.text.match(ABSOLUTE_REF)
    if (absolute) problems.push(`${f.path}: root-absolute reference \`${absolute[0]}\``)
    const remote = f.text.match(OTHER_ORIGIN)
    if (remote) problems.push(`${f.path}: other-origin reference \`${remote[0]}\``)
  }
  return problems
}
