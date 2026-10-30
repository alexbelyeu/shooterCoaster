#!/usr/bin/env node
/**
 * Measures one file against the mix targets in docs/audio/SOUND-BIBLE.md.
 *
 *   npm run audio:check -- <file.wav|mp3> [--kind music|mix|sfx] [--seam 8.99[,17.88]] [--json] [--strict]
 *
 * A render's sidecar JSON (same name) supplies the kind, seams and SFX list. Exits 1 only with --strict.
 */
import fs from 'node:fs'
import { measure, requireFfmpeg, soundLines, targetTable } from './measure.mjs'

const argv = process.argv.slice(2)
const flag = (name) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const file = argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.match(/^--(kind|seam)$/))
if (!file || !fs.existsSync(file)) {
  console.error('usage: npm run audio:check -- <file.wav|mp3> [--kind music|mix|sfx] [--seam <s>[,<s>…]] [--json] [--strict]')
  process.exit(2)
}
requireFfmpeg()

const sidecarPath = file.replace(/\.(wav|mp3)$/i, '.json')
const sidecar = sidecarPath !== file && fs.existsSync(sidecarPath) ? JSON.parse(fs.readFileSync(sidecarPath, 'utf8')) : null
const kind = flag('kind') ?? sidecar?.kind ?? 'music'
const seamArg = flag('seam')
const seams = seamArg ? seamArg.split(',').map(Number) : (sidecar?.seams ?? [])

const metrics = measure(file, { seams, bar: seamArg ? null : (sidecar?.bar ?? null), sounds: kind === 'sfx' ? (sidecar?.events ?? []) : [] })
if (argv.includes('--json')) {
  console.log(JSON.stringify({ file, kind, ...metrics }, null, 2))
}
const [table, failed] = targetTable(metrics, kind)
console.log(`${file}  (${kind}, ${metrics.seconds} s${seams.length ? `, ${seams.length} seam(s)` : ''})\n${table}`)
if (metrics.sounds) console.log(soundLines(metrics.sounds))
if (failed && argv.includes('--strict')) process.exit(1)
