#!/usr/bin/env node
/**
 * Ride review (#925): one whole run of a level the way a player sees it, so an agent can judge a ride without playing it.
 *
 *   npm run build && npm run review -- --level level6        (cloud sessions: export SC_CHROME first; ~10-20 min)
 *
 * Renders the run in virtual time (`virtualTime.mjs`, like `npm run clip`), playing it as the pacing gate does
 * (`PLAYER_HITS_PER_SECOND` on what the rider can shoot), and every step
 * reads what the rider can actually shoot (`__SC_TEST__.sight()`: in view, big enough, not behind the world) and whether the
 * boss is framed. Writes to e2e-results/review/<level>/:
 *   - `review.json`: the timeline (a row per step: level time, track, shootable / occluded / tiny, boss), the gaps with
 *     nothing shootable (`pacingMetrics`), the boss's framing (`bossFraming`), and the flicker spikes (a screen region that
 *     jumps in brightness for one step and comes back, the next step);
 *   - `sheet.jpg`: a contact sheet, a frame every `--every` seconds, each labelled with its time, track and counts (a red
 *     label: nothing shootable), the first thing to look at;
 *   - `frames/`: the sheet's frames at full size.
 * Options: --level level6 --size 960x540 --step 100 (ms of game time a step) --every 2 (s between sheet frames)
 *   --seed 1337 --quality low --no-fire (nothing shot: every enemy stays) --seconds <cap> --url <preview>
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { arg, launchBrowser, startPreview, stopPreview } from './headless.mjs'
import { virtualFrames } from './virtualTime.mjs'
import { PLAYER_HITS_PER_SECOND, bossFraming, pacingMetrics } from '../e2e/pacingMetric.mjs'
import { flickerSpikes } from './flicker.mjs'

const LEVEL = arg('level', 'level6')
const SIZE = arg('size', '960x540')
const STEP_MS = Number(arg('step', 100))
const EVERY_S = Number(arg('every', 2))
const SEED = Number(arg('seed', 1337))
const QUALITY = arg('quality', 'low')
const FIRE = !process.argv.includes('--no-fire')
const CAP_S = Number(arg('seconds', 600))
const [WIDTH, HEIGHT] = SIZE.split('x').map(Number)
const OUT = path.resolve('e2e-results/review', LEVEL)
const FRAMES = path.join(OUT, 'frames')
const LOAD_TIMEOUT_MS = 300_000
const EPOCH = Date.UTC(2026, 0, 1)
/** The flicker probe's downscale: a ~1/12 screenshot is enough to see a region light up. */
const PROBE_SCALE = 1 / 12

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Decodes an 8-bit RGB / RGBA non-interlaced PNG (what CDP returns) to luma rows. */
export function pngLuma(buf) {
  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)
  const colorType = buf[25]
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0
  if (buf[24] !== 8 || !channels || buf[28] !== 0) throw new Error(`pngLuma: unsupported PNG (depth ${buf[24]}, colour ${colorType})`)
  const idat = []
  for (let at = 8; at < buf.length; ) {
    const len = buf.readUInt32BE(at)
    if (buf.toString('ascii', at + 4, at + 8) === 'IDAT') idat.push(buf.subarray(at + 8, at + 8 + len))
    at += 12 + len
  }
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const prev = new Uint8Array(stride)
  const row = new Uint8Array(stride)
  const luma = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? row[i - channels] : 0
      const b = prev[i]
      const c = i >= channels ? prev[i - channels] : 0
      let v = line[i]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      row[i] = v & 255
    }
    for (let x = 0; x < width; x++) {
      const i = x * channels
      luma[y * width + x] = 0.2126 * row[i] + 0.7152 * row[i + 1] + 0.0722 * row[i + 2]
    }
    prev.set(row)
  }
  return { width, height, luma }
}

async function run(browser, url) {
  fs.rmSync(OUT, { recursive: true, force: true })
  fs.mkdirSync(FRAMES, { recursive: true })
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } })
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))
  await page.clock.install({ time: EPOCH })
  await page.clock.pauseAt(EPOCH + 1000)
  await page.addInitScript(virtualFrames, SEED)
  const cdp = await page.context().newCDPSession(page)
  const started = Date.now()
  const hook = (fn, a) => page.evaluate(fn, a)
  const frame = async (ms) => {
    if (ms > 0) await page.clock.runFor(ms)
    await page.evaluate(() => window.__clipFrame())
    await page.evaluate((m) => window.__clipAnimations(m), ms)
  }
  const settle = async (label, ms, fn) => {
    const deadline = Date.now() + LOAD_TIMEOUT_MS
    while (!(await page.evaluate(fn).catch(() => false))) {
      if (Date.now() > deadline) throw new Error(`review: timed out waiting for ${label}`)
      await frame(ms)
      await sleep(200)
    }
  }

  await page.goto(`${url}/?e2e=1&seed=${SEED}&quality=${encodeURIComponent(QUALITY)}`)
  await settle('the game to boot', 50, () => window.__SC_TEST__?.levels().length > 0 && window.__SC_TEST__.frames >= 3)
  const known = await hook((id) => window.__SC_TEST__.levels().some((l) => l.id === id), LEVEL)
  if (!known) throw new Error(`review: unknown level ${LEVEL}`)
  await hook((id) => window.__SC_TEST__.startLevel(id), LEVEL)
  // Held at the start while the level's chunk and shaders load (`clip.mjs`), so the run starts with the full timer.
  await hook(() => {
    const t = window.__SC_TEST__
    t.rideTo = 0
    t.timerStep = 0
    t.rideRate = 0
  })
  await settle('the level to load', STEP_MS, () => {
    const t = window.__SC_TEST__
    return t.phase() === 'playing' && t.levelReady() && t.rideTo === null
  })
  await hook(([fire, rate]) => {
    const t = window.__SC_TEST__
    t.timerStep = null
    t.rideRate = null
    t.autoFire(fire, rate)
    const label = document.createElement('div')
    label.id = 'review-label'
    label.style.cssText =
      'position:fixed;left:50%;top:6px;transform:translateX(-50%);z-index:2147483647;pointer-events:none;' +
      'font:600 15px/1.2 system-ui,sans-serif;color:#fff;padding:3px 10px;border-radius:4px;white-space:nowrap'
    document.body.append(label)
  }, [FIRE, PLAYER_HITS_PER_SECOND])

  const samples = []
  const probes = []
  const sheet = []
  let nextSheet = 0
  for (let step = 0; ; step++) {
    await frame(STEP_MS)
    const s = await hook(() => {
      const t = window.__SC_TEST__
      const st = t.stats()
      const w = t.nextWave()
      const sight = t.sight()
      const boss = t.boss()
      const row = {
        t: w ? sight.levelTime : null,
        phase: st.phase,
        track: t.rideProgress,
        targets: sight.shootable,
        occluded: sight.occluded,
        tiny: sight.tiny,
        live: st.liveEnemies,
        kills: st.kills,
        bossStage: sight.bossStage,
        bossFramed: sight.bossFramed,
        bossOnScreen: boss.exposed.filter((e) => e.onScreen).length,
        bossTell: boss.stage === 'incoming',
      }
      const label = document.getElementById('review-label')
      if (label && row.t != null) {
        const bossText = row.bossStage === 'active' ? ` · boss ${row.bossFramed ? 'framed' : 'OUT OF SIGHT'}` : ''
        label.textContent =
          `${row.t.toFixed(1)} s · track ${row.track.toFixed(3)} · shootable ${row.targets} (hidden ${row.occluded}, specks ${row.tiny}, live ${row.live})${bossText}`
        label.style.background = row.targets > 0 ? 'rgba(20,90,40,.85)' : 'rgba(170,20,20,.9)'
      }
      return row
    })
    if (s.phase !== 'playing' || s.t == null) {
      if (samples.length) break
      continue
    }
    samples.push(s)
    const probe = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: PROBE_SCALE },
    })
    probes.push({ t: s.t, ...pngLuma(Buffer.from(probe.data, 'base64')) })
    if (s.t >= nextSheet) {
      const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 })
      const file = path.join(FRAMES, `${String(sheet.length + 1).padStart(3, '0')}.jpg`)
      fs.writeFileSync(file, Buffer.from(shot.data, 'base64'))
      sheet.push({ t: s.t, file })
      nextSheet = Math.floor(s.t / EVERY_S) * EVERY_S + EVERY_S
    }
    if (step % 50 === 0) console.log(`review: ${s.t.toFixed(1)} s of level time (${Math.round((Date.now() - started) / 1000)} s)`)
    if (s.t >= CAP_S) break
  }
  const end = samples.at(-1).t + STEP_MS / 1000
  const errors = await hook(() => window.__SC_TEST__.errors)
  return { samples, probes, sheet, end, errors: [...errors, ...pageErrors], renderSeconds: Math.round((Date.now() - started) / 1000) }
}

function contactSheet(sheet) {
  const cols = 5
  const rows = Math.ceil(sheet.length / cols)
  const file = path.join(OUT, 'sheet.jpg')
  const w = 384
  const h = Math.round((w * HEIGHT) / WIDTH)
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-framerate', '1', '-i', path.join(FRAMES, '%03d.jpg'),
    '-vf', `scale=${w}:${h},tile=${cols}x${rows}:padding=4:color=black`, '-frames:v', '1', '-q:v', '4', file,
  ])
  return file
}

const round = (x, p = 2) => Number(x.toFixed(p))

let preview, browser
try {
  const given = arg('url')
  if (!given) preview = await startPreview()
  browser = await launchBrowser()
  const r = await run(browser, given ?? preview.url)
  const pacing = pacingMetrics(r.samples, r.end)
  const boss = bossFraming(r.samples, r.end)
  const flicker = flickerSpikes(r.probes)
  const report = {
    level: LEVEL, seed: SEED, size: SIZE, stepMs: STEP_MS, fired: FIRE, quality: QUALITY, renderSeconds: r.renderSeconds,
    pacing, boss, flicker,
    timeline: r.samples.map((s) => ({ ...s, t: round(s.t), track: round(s.track, 3) })),
    sheet: r.sheet.map((f) => ({ t: round(f.t), file: path.relative(OUT, f.file) })),
    errors: r.errors,
  }
  fs.writeFileSync(path.join(OUT, 'review.json'), JSON.stringify(report, null, 1))
  const sheetFile = contactSheet(r.sheet)
  console.log(`review: ${LEVEL}, ${r.samples.length} steps in ${r.renderSeconds} s, ${FIRE ? 'firing' : 'unfired'}`)
  console.log(`  nothing shootable ${(pacing.noTargetShare * 100).toFixed(0)}% of ${pacing.runSeconds.toFixed(0)} s; gaps ≥ 1 s:`)
  for (const g of pacing.gaps) console.log(`    ${g.start.toFixed(1)} s for ${g.seconds.toFixed(1)} s (track ${g.track.toFixed(3)})`)
  if (boss) {
    console.log(`  boss: arrives ${boss.arrivedAt.toFixed(1)} s, shootable ${boss.framedSeconds.toFixed(1)} of ${boss.fightSeconds.toFixed(0)} s, ` +
      `longest out of sight ${boss.longestUnframed.seconds.toFixed(1)} s from ${boss.longestUnframed.start.toFixed(1)} s`)
  } else console.log('  boss: never reached its fight')
  for (const f of flicker.slice(0, 5)) console.log(`  flicker: ${f.region} ${f.count} spikes, first at ${f.first.toFixed(1)} s (Δ${f.peak.toFixed(0)})`)
  if (r.errors.length) console.log(`  page errors:\n    ${r.errors.join('\n    ')}`)
  console.log(`  ${path.relative('.', sheetFile)}, ${path.relative('.', path.join(OUT, 'review.json'))}`)
} finally {
  await browser?.close()
  if (preview) stopPreview(preview.proc)
}
