#!/usr/bin/env node
/**
 * Bundle-size guardrail. Run after `npm run build`.
 * Fails if total gzipped JS in dist/, the largest chunk, or the startup JS (what index.html loads before the title, #376)
 * exceeds its budget in budgets.json.
 * Raising a budget is a Director decision and must be logged in docs/agents/DECISIONS.md.
 * Also fails if the online leaderboard's server side (api/: Supabase's REST API and its key) reaches the browser,
 * or if one of Alex's notes in the gym blockout does (vite.config.ts strips them, #544), or the blockout is in the startup JS (#589).
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const budgets = JSON.parse(fs.readFileSync('budgets.json', 'utf8'))
const dir = 'dist/assets'
if (!fs.existsSync(dir)) {
  console.error('dist/assets not found — run `npm run build` first')
  process.exit(1)
}

// What index.html loads before the title: its entry script and modulepreloads. The rest (the level scene, the score engine…) is lazy.
const html = fs.readFileSync('dist/index.html', 'utf8')
const startup = new Set([...html.matchAll(/(?:src|href)="[^"]*\/assets\/([^"]+\.js)"/g)].map((m) => m[1]))

/** Only api/ may know these: the browser talks to /api/leaderboard and /api/telemetry and nothing else (#365, #373). */
const SERVER_ONLY = /SUPABASE_SECRET_KEY|SUPABASE_URL|\/rest\/v1\/|supabase\.co/
const leaks = []

/** The start of each blockout note, as plain words that read the same in any string escaping. */
const blockout = JSON.parse(fs.readFileSync('src/levels/environments/biomes/gym/blockout.json', 'utf8'))
const notes = [blockout.notes, ...blockout.items.map((item) => item.note)]
  .map((note) => note?.match(/^[\w ,.()-]{12,}/)?.[0])
  .filter(Boolean)
const noteLeaks = []
/** The blockout's piece ids, but the climbed walls' (`gymLevel.ts` names those): the title never loads the blockout (#589). */
const pieceIds = blockout.items.map((item) => item.id).filter((id) => id.includes('-') && !id.startsWith('w-'))
const blockoutAtStartup = []

let totalGz = 0
let largestGz = 0
let startupGz = 0
const rows = []
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.js')) continue
  const buf = fs.readFileSync(path.join(dir, f))
  const gz = zlib.gzipSync(buf, { level: 9 }).length
  totalGz += gz
  largestGz = Math.max(largestGz, gz)
  if (startup.has(f)) startupGz += gz
  const text = buf.toString('utf8')
  if (SERVER_ONLY.test(text)) leaks.push(f)
  if (notes.some((note) => text.includes(note))) noteLeaks.push(f)
  if (startup.has(f) && pieceIds.some((id) => text.includes(id))) blockoutAtStartup.push(f)
  rows.push([f, (buf.length / 1024).toFixed(0), (gz / 1024).toFixed(0)])
}
rows.sort((a, b) => Number(b[2]) - Number(a[2]))
for (const [f, raw, gz] of rows) console.log(`${gz.padStart(6)} KB gz  ${raw.padStart(6)} KB  ${f}${startup.has(f) ? '  (startup)' : ''}`)

const totalKb = totalGz / 1024
const largestKb = largestGz / 1024
const startupKb = startupGz / 1024
console.log(`Startup JS: ${startupKb.toFixed(0)} KB gz (budget ${budgets.startupJsGzipKB} KB; ${startup.size} files from index.html, the rest loads on demand)`)
console.log(`Total JS: ${totalKb.toFixed(0)} KB gz (budget ${budgets.jsTotalGzipKB} KB); largest chunk ${largestKb.toFixed(0)} KB gz (budget ${budgets.jsLargestChunkGzipKB} KB)`)

let ok = true
if (totalKb > budgets.jsTotalGzipKB) {
  console.error(`FAIL: total JS over budget by ${(totalKb - budgets.jsTotalGzipKB).toFixed(0)} KB`)
  ok = false
}
if (largestKb > budgets.jsLargestChunkGzipKB) {
  console.error(`FAIL: largest chunk over budget by ${(largestKb - budgets.jsLargestChunkGzipKB).toFixed(0)} KB`)
  ok = false
}
if (startupKb > budgets.startupJsGzipKB) {
  console.error(`FAIL: startup JS over budget by ${(startupKb - budgets.startupJsGzipKB).toFixed(0)} KB (index.html loads it before the title; lazy-load what the title doesn't need)`)
  ok = false
}
if (leaks.length) {
  console.error(`FAIL: server-only leaderboard code in the browser bundle: ${leaks.join(', ')}`)
  ok = false
}
if (noteLeaks.length) {
  console.error(`FAIL: the gym blockout's notes in the browser bundle: ${noteLeaks.join(', ')} (vite.config.ts stripBlockoutNotes)`)
  ok = false
}
if (blockoutAtStartup.length) {
  console.error(`FAIL: the gym blockout in the startup JS: ${blockoutAtStartup.join(', ')} (level 6's ride is gymLevel.ts, in the gym world's chunk)`)
  ok = false
}
process.exit(ok ? 0 : 1)
