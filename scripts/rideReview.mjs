#!/usr/bin/env node
/**
 * Ride review (#925): one whole run of a level the way a player sees it, so an agent can judge a ride without playing it.
 *
 *   npm run build && npm run review -- --level level6        (cloud sessions: export SC_CHROME first; ~3 min for level 6)
 *
 * Renders the run in virtual time (`virtualTime.mjs`, like `npm run clip`), playing it as the pacing gate does
 * (`PLAYER_HITS_PER_SECOND` on what the rider can shoot), and every step
 * reads what the rider can actually shoot (`__SC_TEST__.sight()`: in view, big enough, not behind the world) and whether the
 * boss is framed. Writes to e2e-results/review/<level>/:
 *   - `review.json`: the timeline (a row per step: level time, track, shootable (and `byType`) / occluded / tiny, boss), the gaps with
 *     nothing shootable (`pacingMetrics`), the boss's framing (`bossFraming`), how hard the run was for the player
 *     (`challengeMetrics`, #1058: score and kill shares, bunching, the boss's time to kill), and the flicker spikes (a screen region that
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
import { arg, launchBrowser, startPreview, stopPreview } from './headless.mjs'
import { virtualFrames } from './virtualTime.mjs'
import { PLAYER_HITS_PER_SECOND, bossFraming, challengeMetrics, challengeSummary, pacingMetrics } from '../e2e/pacingMetric.mjs'
import { flickerSpikes, pngLuma } from './flicker.mjs'

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
        byType: sight.byType,
        occluded: sight.occluded,
        tiny: sight.tiny,
        live: st.liveEnemies,
        kills: st.kills,
        bossStage: sight.bossStage,
        bossFramed: sight.bossFramed,
        bunch: sight.bunch,
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
  // The run's end (#1058): its final score and enemies for the challenge measures.
  const result = await hook((id) => {
    const t = window.__SC_TEST__
    return { score: t.stats().score, maxScore: t.levels().find((l) => l.id === id)?.maxScore ?? 0, ...t.runTally() }
  }, LEVEL)
  return { samples, probes, sheet, end, result, errors: [...errors, ...pageErrors], renderSeconds: Math.round((Date.now() - started) / 1000) }
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
  const challenge = challengeMetrics(r.samples, r.result, boss)
  const flicker = flickerSpikes(r.probes)
  const report = {
    level: LEVEL, seed: SEED, size: SIZE, stepMs: STEP_MS, fired: FIRE, quality: QUALITY, renderSeconds: r.renderSeconds,
    pacing, boss, challenge, flicker,
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
  console.log(`  challenge: ${challengeSummary(challenge)}`)
  for (const f of flicker.slice(0, 5)) console.log(`  flicker: ${f.region} ${f.count} spikes, first at ${f.first.toFixed(1)} s (Δ${f.peak.toFixed(0)})`)
  if (r.errors.length) console.log(`  page errors:\n    ${r.errors.join('\n    ')}`)
  console.log(`  ${path.relative('.', sheetFile)}, ${path.relative('.', path.join(OUT, 'review.json'))}`)
} finally {
  await browser?.close()
  if (preview) stopPreview(preview.proc)
}
