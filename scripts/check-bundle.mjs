#!/usr/bin/env node
/**
 * Bundle-size guardrail. Run after `npm run build`.
 * Fails if total gzipped JS in dist/ exceeds the budget in budgets.json.
 * Raising a budget is a Director decision and must be logged in docs/agents/DECISIONS.md.
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

// What index.html loads before the title: its entry script and modulepreloads. The rest (Tone.js, the score engine…) is lazy.
const html = fs.readFileSync('dist/index.html', 'utf8')
const startup = new Set([...html.matchAll(/(?:src|href)="[^"]*\/assets\/([^"]+\.js)"/g)].map((m) => m[1]))

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
  rows.push([f, (buf.length / 1024).toFixed(0), (gz / 1024).toFixed(0)])
}
rows.sort((a, b) => Number(b[2]) - Number(a[2]))
for (const [f, raw, gz] of rows) console.log(`${gz.padStart(6)} KB gz  ${raw.padStart(6)} KB  ${f}${startup.has(f) ? '  (startup)' : ''}`)

const totalKb = totalGz / 1024
const largestKb = largestGz / 1024
console.log(`Startup JS: ${(startupGz / 1024).toFixed(0)} KB gz (${startup.size} files from index.html; the rest loads on demand)`)
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
process.exit(ok ? 0 : 1)
