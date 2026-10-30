#!/usr/bin/env node
/**
 * Renders the game's current music / SFX offline (faster than real time, independent of
 * the frame rate) and measures it, for Alex's ears and the Sound designer's numbers.
 *
 *   npm run build && npm run audio:render -- --music level1 [--intensity 0.45] [--seconds 30]
 *   npm run audio:render -- --music title
 *   npm run audio:render -- --sfx-sheet [--level level1]
 *   npm run audio:render -- --mix level1 [--seconds 20]
 *
 * Options: --name <file name> (default music-<track> / sfx-sheet-<level> / mix-<level>)
 *   --out docs/audio/renders  --seed 1  --url <running preview>
 * Writes <out>/<name>.mp3 (128 kbps), .json (request, events, loop seams, metrics vs the
 * sound bible's targets) and .png (log-frequency spectrogram); the exact float WAV it
 * measured stays in e2e-results/audio/. Needs ffmpeg; cloud sessions: export SC_CHROME.
 *
 * The page runs `__SC_TEST__.renderAudio` (src/testing/audioRender.ts): Tone's own nodes
 * in an OfflineAudioContext, driven by the game's music and SFX code.
 */
import fs from 'node:fs'
import path from 'node:path'
import { launchBrowser, startPreview, stopPreview } from '../headless.mjs'
import { measure, requireFfmpeg, soundLines, spectrogram, targetTable, toMp3, writeFloatWav } from './measure.mjs'
import { compareTargets } from './metrics.mjs'

const argv = process.argv.slice(2)
const flag = (name) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const num = (name) => (flag(name) === undefined ? undefined : Number(flag(name)))

let request
let kind
let defaultName
if (flag('music')) {
  request = { kind: 'music', track: flag('music'), intensity: num('intensity'), seconds: num('seconds') }
  kind = 'music'
  defaultName = `music-${flag('music')}`
} else if (argv.includes('--sfx-sheet')) {
  request = { kind: 'sfxSheet', level: flag('level') }
  kind = 'sfx'
  defaultName = `sfx-sheet-${flag('level') ?? 'level1'}`
} else if (flag('mix')) {
  request = { kind: 'mix', level: flag('mix'), seconds: num('seconds') }
  kind = 'mix'
  defaultName = `mix-${flag('mix')}`
} else {
  console.error('usage: npm run audio:render -- --music <title|level1..level5> | --sfx-sheet [--level <id>] | --mix <level>  [--name n] [--out dir] [--seed n]')
  process.exit(2)
}
const NAME = flag('name') ?? defaultName
const OUT = path.resolve(flag('out') ?? 'docs/audio/renders')
const SEED = num('seed') ?? 1
const MAX_SECONDS = 30

requireFfmpeg()
fs.mkdirSync(OUT, { recursive: true })
const wavDir = path.resolve('e2e-results/audio')
fs.mkdirSync(wavDir, { recursive: true })

const preview = flag('url') ? null : await startPreview()
const url = flag('url') ?? preview.url
const browser = await launchBrowser()
let result
let renderS
try {
  // A tiny canvas: software GL drawing the title scene competes with the render for the CPU.
  const page = await browser.newPage({ viewport: { width: 160, height: 90 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(`${url}/?e2e=1`, { timeout: 180_000 })
  await page.waitForFunction(() => window.__SC_TEST__?.phase() === 'title', null, { timeout: 180_000 })
  const t0 = Date.now()
  result = await page.evaluate(([req, seed]) => window.__SC_TEST__.renderAudio(req, seed), [request, SEED])
  renderS = (Date.now() - t0) / 1000
  if (errors.length) throw new Error(`page errors during the render:\n${errors.join('\n')}`)
} finally {
  await browser.close()
  if (preview) stopPreview(preview.proc)
}
if (result.seconds > MAX_SECONDS) throw new Error(`render is ${result.seconds} s; renders stay ≤ ${MAX_SECONDS} s`)

const bytes = Buffer.from(result.pcm, 'base64')
const wav = path.join(wavDir, `${NAME}.wav`)
writeFloatWav(wav, new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4), result.sampleRate)
const metrics = measure(wav, { seams: result.seams, bar: result.bar, sounds: kind === 'sfx' ? result.events : [] })
toMp3(wav, path.join(OUT, `${NAME}.mp3`))
spectrogram(wav, path.join(OUT, `${NAME}.png`))

const report = {
  name: NAME,
  kind,
  request,
  seed: SEED,
  sampleRate: result.sampleRate,
  measuredFrom: 'the float WAV render (the MP3 is for listening)',
  events: result.events,
  seams: result.seams,
  bar: result.bar,
  metrics,
  targets: compareTargets(metrics, kind).map(({ label, value, unit, status, min, max }) =>
    status === 'info' ? { label, value, unit, status } : { label, value, unit, min, max, status },
  ),
}
fs.writeFileSync(path.join(OUT, `${NAME}.json`), `${JSON.stringify(report, null, 2)}\n`)

const [table] = targetTable(metrics, kind)
console.log(`${NAME}: ${result.seconds} s of audio rendered in ${renderS.toFixed(1)} s → ${path.relative(process.cwd(), OUT)}/${NAME}.{mp3,json,png}\n${table}`)
if (metrics.sounds) console.log(soundLines(metrics.sounds))
