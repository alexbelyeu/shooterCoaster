#!/usr/bin/env node
/**
 * Renders the game's current music / SFX offline in the page (`__SC_TEST__.renderAudio`) and measures it.
 *
 *   npm run build && npm run audio:render -- --music <title|level1..5|results> [--intensity 0.45] [--seconds 30] [--engine scrim]
 *   npm run audio:render -- --sfx-sheet [--level level1] [--engine scrim]
 *   npm run audio:render -- --mix level1 [--seconds 20] [--engine scrim]
 *   npm run audio:render -- --score <file.scrim | vendored:1..6> [--engine port|original] [--voicing jukebox|game] [--seconds 20]
 *
 * --engine scrim plays the music through the score engine and the SFX through the arcade engine (`?audio=scrim`). --score renders one score alone: through
 * the port (default) or the original Scrimshaw page (docs/audio/reference/scrimshaw-jukebox.html), both seeded alike.
 * Options: --name <file name> (default music-<track> / sfx-sheet-<level> / mix-<level>, scrim-… with the score engine,
 *   score-<engine>-<score>) --out docs/audio/renders  --seed 1  --url <running preview>
 * Writes <out>/<name>.{mp3,json,png}; the float WAV it measured stays in e2e-results/audio/ (a --mix also renders
 * <name>-music.wav, the same mix without SFX, to measure each kill against the music around it).
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { launchBrowser, startPreview, stopPreview } from '../headless.mjs'
import { killTimes, measure, requireFfmpeg, soundLines, spectrogram, targetTable, toMp3, writeFloatWav } from './measure.mjs'
import { compareTargets } from './metrics.mjs'

const argv = process.argv.slice(2)
const flag = (name) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const num = (name) => (flag(name) === undefined ? undefined : Number(flag(name)))

const VENDORED = path.resolve('docs/audio/reference/scrimshaw-jukebox.html')

/** `vendored:N` → the original page's Nth demo score; anything else is a score file. */
function readScore(arg) {
  const m = /^vendored:(\d)$/.exec(arg)
  if (!m) return { text: fs.readFileSync(arg, 'utf8'), label: path.basename(arg, path.extname(arg)) }
  const tracks = JSON.parse(/^const TRACKS = (\[.*\]);$/m.exec(fs.readFileSync(VENDORED, 'utf8'))[1])
  const track = tracks[Number(m[1]) - 1]
  if (!track) throw new Error(`no vendored score ${m[1]} (1–${tracks.length})`)
  return { text: track.text, label: track.file.replace(/\.scrim$/, '') }
}

const engine = flag('engine')
const scrimPrefix = engine === 'scrim' ? 'scrim-' : ''
let request
let kind
let defaultName
let original = false
if (flag('music')) {
  request = { kind: 'music', track: flag('music'), intensity: num('intensity'), seconds: num('seconds'), engine }
  kind = 'music'
  defaultName = `${scrimPrefix}music-${flag('music')}`
} else if (argv.includes('--sfx-sheet')) {
  request = { kind: 'sfxSheet', level: flag('level'), engine }
  kind = 'sfx'
  defaultName = `${scrimPrefix}sfx-sheet-${flag('level') ?? 'level1'}`
} else if (flag('mix')) {
  request = { kind: 'mix', level: flag('mix'), seconds: num('seconds'), engine }
  kind = 'mix'
  defaultName = `${scrimPrefix}mix-${flag('mix')}`
} else if (flag('score')) {
  const { text, label } = readScore(flag('score'))
  original = engine === 'original'
  request = { kind: 'score', text, seconds: num('seconds') ?? 20, voicing: flag('voicing') }
  kind = 'music'
  defaultName = `score-${original ? 'original' : 'port'}-${label}`
} else {
  console.error('usage: npm run audio:render -- --music <title|level1..level5|results> | --sfx-sheet [--level <id>] | --mix <level> | --score <file|vendored:N>  [--engine scrim|port|original] [--name n] [--out dir] [--seed n]')
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

/**
 * In the original page: the same seeded PRNG as the port's render (`createRng`, mulberry32) swapped into Math.random,
 * then its own compiler and `renderOffline`, returned in `renderAudio`'s shape.
 */
async function renderOriginal(page, { text, seconds }, seed) {
  return page.evaluate(
    async ([text, seconds, seed]) => {
      let a = seed >>> 0
      const rng = () => {
        a = (a + 0x6d2b79f5) >>> 0
        let t = a
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
      const song = window.ScrimScore.compile(text)
      if (song.errors.length) throw new Error(song.errors.map((e) => `line ${e.line}: ${e.msg}`).join('\n'))
      const random = Math.random
      Math.random = rng
      let buf
      try {
        buf = await window.ScrimSynth.renderOffline(song, seconds, 44100)
      } finally {
        Math.random = random
      }
      const l = buf.getChannelData(0), r = buf.getChannelData(1)
      const pcm = new Float32Array(l.length * 2)
      for (let i = 0; i < l.length; i++) { pcm[2 * i] = l[i]; pcm[2 * i + 1] = r[i] }
      const bytes = new Uint8Array(pcm.buffer)
      let s = ''
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
      const start = 0.05
      const seams = []
      if (song.loop.dur > 0) for (let t = start + song.intro.dur + song.loop.dur; t < seconds - 0.5; t += song.loop.dur) seams.push(t)
      const sec = song.loop.sections[0] ?? song.intro.sections[0]
      return {
        sampleRate: buf.sampleRate, seconds, pcm: btoa(s), events: [{ t: start, name: song.title }], seams,
        bar: sec ? { startS: start + song.intro.dur, barS: sec.barDur } : null,
      }
    },
    [text, seconds, seed],
  )
}

const preview = flag('url') || original ? null : await startPreview()
const url = flag('url') ?? preview?.url
const browser = await launchBrowser()
let result
let musicStem = null
let renderS
try {
  // A tiny canvas: software GL drawing the title scene competes with the render for the CPU.
  const page = await browser.newPage({ viewport: { width: 160, height: 90 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  if (original) {
    // The page's web fonts can't load offline; its scripts don't need them.
    await page.route(/^https?:/, (route) => route.abort())
    await page.goto(pathToFileURL(VENDORED).href, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForFunction(() => window.ScrimSynth && window.ScrimScore, null, { timeout: 60_000 })
  } else {
    await page.goto(`${url}/?e2e=1`, { timeout: 180_000 })
    await page.waitForFunction(() => window.__SC_TEST__?.phase() === 'title', null, { timeout: 180_000 })
  }
  const t0 = Date.now()
  result = original
    ? await renderOriginal(page, request, SEED)
    : await page.evaluate(([req, seed]) => window.__SC_TEST__.renderAudio(req, seed), [request, SEED])
  // A combat mix's kills are measured against the same mix without SFX: "the music around it".
  if (request.kind === 'mix') {
    musicStem = await page.evaluate(([req, seed]) => window.__SC_TEST__.renderAudio(req, seed), [{ ...request, stem: 'music' }, SEED])
  }
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
let musicFile = null
if (musicStem) {
  const stem = Buffer.from(musicStem.pcm, 'base64')
  musicFile = path.join(wavDir, `${NAME}-music.wav`)
  writeFloatWav(musicFile, new Float32Array(stem.buffer, stem.byteOffset, stem.byteLength / 4), musicStem.sampleRate)
}
const metrics = measure(wav, { seams: result.seams, bar: result.bar, sounds: kind === 'sfx' ? result.events : [], kills: killTimes(result.events), musicFile })
toMp3(wav, path.join(OUT, `${NAME}.mp3`))
spectrogram(wav, path.join(OUT, `${NAME}.png`))

const report = {
  name: NAME,
  kind,
  request: request.kind === 'score' ? { ...request, text: undefined, score: flag('score'), engine: original ? 'original' : 'port' } : request,
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
