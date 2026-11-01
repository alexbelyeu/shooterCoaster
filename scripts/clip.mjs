#!/usr/bin/env node
/**
 * Renders the launch-post gameplay clip: title → level select → ride with autofire, as
 * docs/marketing/media/clip-<level>-<size>.mp4 plus -{start,mid,end}.jpg stills, and a GIF of the
 * ride's start next to the frames in e2e-results/clip/<size>/ (not committed: docs/marketing/media/README.md).
 *
 *   npm run build && npm run clip        (needs ffmpeg; cloud sessions: export SC_CHROME first)
 *
 * Software GL draws ~0.5 fps, so the page runs in virtual time (decision 2026-10-28, #100):
 * every captured frame is exactly one step of fake clock, rAF and CSS animation time.
 *
 * Options: --level level1 --from 0.42 (track fraction; level 1's Ferris wheel pass) --seconds 15
 *   --fps 30 --size 1280x720 (or 720x1280) --seed 1337 --intro 2.5 --select 1.5 --kill-every 1.5
 *   --gif-seconds 8 --out docs/marketing/media --url <running preview> --frames-only --encode-only
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { arg, launchBrowser, startPreview, stopPreview } from './headless.mjs'

const LEVEL = arg('level', 'level1')
const FROM = Number(arg('from', 0.42))
const RIDE_S = Number(arg('seconds', 15))
const FPS = Number(arg('fps', 30))
const SIZE = arg('size', '1280x720')
const SEED = Number(arg('seed', 1337))
const INTRO_S = Number(arg('intro', 2.5))
const SELECT_S = Number(arg('select', 1.5))
const KILL_EVERY_S = Number(arg('kill-every', 1.5))
const GIF_S = Number(arg('gif-seconds', 8))
const OUT_DIR = path.resolve(arg('out', 'docs/marketing/media'))
const FRAMES_ONLY = process.argv.includes('--frames-only')
const ENCODE_ONLY = process.argv.includes('--encode-only')
const [WIDTH, HEIGHT] = SIZE.split('x').map(Number)
const FRAME_DIR = path.resolve('e2e-results/clip', SIZE)
const NAME = `clip-${LEVEL}-${SIZE}`
/** The fake clock ticks whole ms; a constant step keeps motion even (30 fps → 33 ms, 1% slow). */
const STEP_MS = Math.round(1000 / FPS)
const MAX_MP4_BYTES = 3 * 1024 * 1024
const MAX_GIF_BYTES = 8 * 1024 * 1024
const GIF_FPS = 15
const GIF_WIDTH = 480
const LOAD_TIMEOUT_MS = 300_000
const EPOCH = Date.UTC(2026, 0, 1)

if (!(WIDTH > 0 && HEIGHT > 0)) throw new Error(`bad --size ${SIZE} (want WxH, e.g. 1280x720)`)
if (!FRAMES_ONLY) {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
  } catch {
    throw new Error('ffmpeg not found: install it (apt-get install -y ffmpeg) or pass --frames-only')
  }
}

/** Page init script: seeded Math.random, a rAF that runs only on __clipFrame(), and __clipAnimations(ms) for CSS animations. */
function virtualFrames(seed) {
  let s = seed >>> 0
  Math.random = () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  let queue = []
  let nextId = 1
  window.requestAnimationFrame = (cb) => {
    queue.push({ id: nextId, cb })
    return nextId++
  }
  window.cancelAnimationFrame = (id) => {
    queue = queue.filter((f) => f.id !== id)
  }
  window.__clipFrame = () => {
    const due = queue
    queue = []
    const now = performance.now()
    for (const f of due) f.cb(now)
  }
  const stepped = new WeakSet()
  window.__clipAnimations = (ms) => {
    for (const a of document.getAnimations()) {
      if (!stepped.has(a)) {
        stepped.add(a)
        a.pause()
        a.currentTime = 0
        continue
      }
      const end = a.effect?.getComputedTiming().endTime ?? Infinity
      const t = (a.currentTime ?? 0) + ms
      if (t >= end) a.finish()
      else a.currentTime = t
    }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const frameFile = (n) => path.join(FRAME_DIR, `${String(n).padStart(5, '0')}.jpg`)

async function render(browser, url) {
  fs.rmSync(FRAME_DIR, { recursive: true, force: true })
  fs.mkdirSync(FRAME_DIR, { recursive: true })
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } })
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))
  await page.clock.install({ time: EPOCH })
  await page.clock.pauseAt(EPOCH + 1000)
  await page.addInitScript(virtualFrames, SEED)
  // page.screenshot waits on a real animation frame, which never comes here; CDP captures directly.
  const cdp = await page.context().newCDPSession(page)
  const started = Date.now()

  const frame = async (ms) => {
    if (ms > 0) await page.clock.runFor(ms)
    await page.evaluate(() => window.__clipFrame())
  }
  const hook = (fn, a) => page.evaluate(fn, a)
  /** Run frames `ms` apart (0: no time passes, nothing animates), uncaptured, until `fn` holds in the page. */
  const settle = async (label, ms, fn) => {
    const deadline = Date.now() + LOAD_TIMEOUT_MS
    while (!(await page.evaluate(fn).catch(() => false))) {
      if (Date.now() > deadline) throw new Error(`clip: timed out waiting for ${label}`)
      await frame(ms)
      await sleep(300)
    }
  }
  let captured = 0
  /** `onFrame(i)` runs before each step; returning false stops early. */
  const capture = async (count, onFrame) => {
    for (let i = 0; i < count; i++) {
      if (onFrame && (await onFrame(i)) === false) return
      await frame(STEP_MS)
      // A separate call, so the React commit the frame scheduled has started its transitions.
      await page.evaluate((ms) => window.__clipAnimations(ms), STEP_MS)
      const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 })
      captured++
      fs.writeFileSync(frameFile(captured), Buffer.from(shot.data, 'base64'))
      if (captured % FPS === 0) console.log(`clip: ${captured} frames (${Math.round((Date.now() - started) / 1000)} s)`)
    }
  }

  await page.goto(`${url}/?e2e=1&seed=${SEED}`)
  // Boot needs timers to run (canvas measure debounce); nothing is captured yet.
  await settle('the game to boot', 50, () => window.__SC_TEST__?.levels().length > 0 && window.__SC_TEST__.frames >= 3)
  // Starring every level before LEVEL unlocks it and puts the level select's first focus on it.
  const unlocked = await hook((id) => {
    const t = window.__SC_TEST__
    const levels = t.levels()
    const at = levels.findIndex((l) => l.id === id)
    if (at < 0) return false
    const best = (l) => ({ level: l.id, score: Math.round(l.maxScore * 0.92), maxScore: l.maxScore, stars: 3, timestamp: 0 })
    t.setSavedScores(Object.fromEntries(levels.slice(0, at).map((l) => [l.id, best(l)])))
    return t.levels().find((l) => l.id === id).unlocked
  }, LEVEL)
  if (!unlocked) throw new Error(`clip: unknown level ${LEVEL}, or still locked after starring the levels before it`)

  await capture(Math.round(INTRO_S * FPS))
  await page.keyboard.press('Enter')
  await capture(Math.round(SELECT_S * FPS))
  const focused = await hook(() => document.activeElement?.textContent ?? '')
  const levelName = await hook((id) => window.__SC_TEST__.levels().find((l) => l.id === id).name, LEVEL)
  if (!focused.includes(levelName)) throw new Error(`clip: level select focus is not on ${levelName} (got "${focused.slice(0, 60)}")`)
  await page.keyboard.press('Enter')
  await capture(FPS * 2, async () => (await hook(() => window.__SC_TEST__.phase())) !== 'playing')
  await hook((f) => { window.__SC_TEST__.rideTo = f }, FROM)
  // No time passes while the level mounts, so the ride starts at --from with the full timer.
  await settle('the level to load', 0, () => {
    const t = window.__SC_TEST__
    return t.phase() === 'playing' && t.weapon?.visible === true && t.rideTo === null
  })

  const rideStart = captured
  const before = await hook(() => ({ ...window.__SC_TEST__.combat }))
  await hook(() => window.__SC_TEST__.autoFire(true))
  let lastKills = before.kills
  let lastKillFrame = 0
  let assisted = 0
  let weaponOff = 0
  await capture(Math.round(RIDE_S * FPS), async (i) => {
    const s = await hook(() => {
      const t = window.__SC_TEST__
      const w = t.weapon
      return {
        kills: t.combat.kills,
        onScreen: t.stats().onScreenEnemies,
        weaponIn: !!w && w.visible && w.tipX >= 0 && w.tipX <= w.width && w.tipY >= 0 && w.tipY <= w.height,
      }
    })
    if (!s.weaponIn) weaponOff++
    if (s.kills > lastKills) {
      lastKills = s.kills
      lastKillFrame = i
    } else if (i - lastKillFrame >= KILL_EVERY_S * FPS && s.onScreen > 0) {
      await hook(() => window.__SC_TEST__.killNearest(1))
      assisted++
      lastKillFrame = i
    }
  })
  const after = await hook(() => {
    const t = window.__SC_TEST__
    t.autoFire(false)
    return { combat: { ...t.combat }, stats: t.stats(), errors: t.errors, digest: t.spawnDigest() }
  })
  return {
    frames: captured,
    rideStart,
    renderSeconds: Math.round((Date.now() - started) / 1000),
    kills: after.combat.kills - before.kills,
    shots: after.combat.fired - before.fired,
    assistedKills: assisted,
    weaponOffFrames: weaponOff,
    score: after.stats.score,
    runSeed: after.stats.runSeed,
    spawnDigest: after.digest,
    errors: [...after.errors, ...pageErrors],
  }
}

const ffmpeg = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' })
const frameInput = (first) => ['-framerate', String(FPS), '-start_number', String(first), '-i', path.join(FRAME_DIR, '%05d.jpg')]

/** Two-pass H.264 at the bitrate that fills the size cap (the scene is too busy for a fixed CRF to fit). */
function encodeMp4(file, frames) {
  const kbps = Math.floor((MAX_MP4_BYTES * 8 * 0.94) / (frames / FPS) / 1000)
  const log = path.join(FRAME_DIR, 'x264-2pass')
  const x264 = ['-c:v', 'libx264', '-preset', 'slow', '-b:v', `${kbps}k`, '-pix_fmt', 'yuv420p', '-passlogfile', log]
  ffmpeg([...frameInput(1), ...x264, '-pass', '1', '-an', '-f', 'mp4', '/dev/null'])
  ffmpeg([...frameInput(1), ...x264, '-pass', '2', '-movflags', '+faststart', file])
  const bytes = fs.statSync(file).size
  if (bytes > MAX_MP4_BYTES) throw new Error(`clip: ${file} is ${kb(bytes)}, over 3 MB`)
  return { bytes, kbps }
}

/** Only the first --gif-seconds of the ride: a whole 15 s ride is ~10 MB as a 480 px GIF. */
function encodeGif(file, rideFirstFrame) {
  for (const colors of [192, 128, 96, 64]) {
    const vf =
      `fps=${GIF_FPS},scale=${GIF_WIDTH}:-2:flags=lanczos,split[a][b];` +
      `[a]palettegen=max_colors=${colors}:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`
    ffmpeg([...frameInput(rideFirstFrame), '-t', String(GIF_S), '-vf', vf, '-loop', '0', file])
    const bytes = fs.statSync(file).size
    if (bytes <= MAX_GIF_BYTES) return { bytes, colors }
  }
  throw new Error(`clip: ${file} is over 8 MB even with 64 colours (try a shorter --gif-seconds)`)
}

function writeStills(frames) {
  const picks = { start: 1, mid: Math.ceil(frames / 2), end: frames }
  return Object.entries(picks).map(([which, n]) => {
    const file = path.join(OUT_DIR, `${NAME}-${which}.jpg`)
    ffmpeg(['-i', frameFile(n), '-q:v', '4', file])
    return file
  })
}

function encode(run) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const mp4 = path.join(OUT_DIR, `${NAME}.mp4`)
  const gif = path.join(FRAME_DIR, `${NAME}.gif`)
  const m = encodeMp4(mp4, run.frames)
  console.log(`clip: ${path.relative('.', mp4)} ${m.kbps} kb/s ${kb(m.bytes)}`)
  const g = encodeGif(gif, run.rideStart + 1)
  console.log(`clip: ${path.relative('.', gif)} ${g.colors} colours ${kb(g.bytes)}`)
  for (const still of writeStills(run.frames)) console.log(`clip: ${path.relative('.', still)} ${kb(fs.statSync(still).size)}`)
}

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`
const RUN_FILE = path.join(FRAME_DIR, 'clip.json')
if (ENCODE_ONLY) {
  encode(JSON.parse(fs.readFileSync(RUN_FILE, 'utf8')))
} else {
  let preview, browser
  try {
    const given = arg('url')
    if (!given) preview = await startPreview()
    browser = await launchBrowser()
    const run = await render(browser, given ?? preview.url)
    fs.writeFileSync(RUN_FILE, JSON.stringify({ level: LEVEL, size: SIZE, fps: FPS, from: FROM, seed: SEED, ...run }, null, 2))
    console.log(
      `clip: ${run.frames} frames (ride from frame ${run.rideStart + 1}) in ${run.renderSeconds} s; ` +
        `ride kills ${run.kills} (${run.assistedKills} via killNearest), shots ${run.shots}, score ${run.score}, ` +
        `seed ${run.runSeed}, spawns ${run.spawnDigest}`,
    )
    if (run.errors.length) throw new Error(`clip: page errors:\n${run.errors.join('\n')}`)
    if (run.weaponOffFrames) throw new Error(`clip: the weapon's muzzle left the frame on ${run.weaponOffFrames} frames`)
    if (!FRAMES_ONLY) encode(run)
  } finally {
    await browser?.close()
    if (preview) stopPreview(preview.proc)
  }
}
