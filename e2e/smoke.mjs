#!/usr/bin/env node
/**
 * ShooterCoaster smoke test / headless playtest.
 *
 * Boots the built game (vite preview) in headless Chromium, checks the title
 * screen renders, then loads EVERY registered level via the ?e2e=1 test hook and
 * verifies: no uncaught errors, the render loop advances, and the frame is not
 * blank. Then it plays: autoFire for a few seconds, killNearest(5) (screenshot
 * <id>-combat.png, with the muzzle flash + gold hitmarker held on the kill frame),
 * and endLevel() (screenshot <id>-results.png). A level fails if nothing was
 * killed, autofire never fired at on-screen enemies, the killNearest hits never
 * produced a kill event, the camera translated off the track pose at all (kill
 * feedback is rotation-only), the kill trauma exceeded 1° or did not decay to 0,
 * the coaster camera's bank / pitch / speed FOV went past their caps (#123),
 * the first-person weapon is missing / off screen / covering the centre / not
 * pointing along the shot's tracer (> 25° on screen; also after an un-held aim jump, #79), the
 * camera aspect doesn't match the canvas, or the results screen never finishes its
 * reveal, lacks a stats row or button, or shows NaN / a score or kills that disagree with stats(),
 * or its Share line (shareText()) or "Copied!" click is wrong (#87).
 * Every level and the phone run (portrait, and after rotating) also run audioBurst():
 * fails on a late note that throws or a sound dropped by an audio error (#115).
 * Bullets (#165): no drawn bullet may exceed 2% of the canvas height on screen (every
 * level and the phone run), and one real shot with time + bullets frozen must be drawn
 * next to the muzzle tip; <id>-shot.png shows it two 40 ms steps into its flight.
 * Saves screenshots + stats to e2e-results/.
 *
 * Spawns use a fixed --seed (default 1337); the seed check reloads the first level
 * and requires the same spawnDigest() for that seed and a different one for another.
 * The daily check starts today's Daily Run from its level-select card on two fresh pages
 * (today's seed, the same spawns) and checks its results, saves and Replay (#184).
 * The hidden-pause check fakes a tab hide on the first level: it must pause, drop a
 * held trigger, keep the timer still (and a primed combo intact), wait for Resume, then
 * neither reset nor jump it, nor bring back killed enemies. On the first level the killNearest kills enter the 5× combo
 * tier: <id>-combat.png must show the "×5 FRENZY" flash during its slow-mo.
 * `?e2e=1` skips the Ready / Set / GO countdown; the countdown check loads the first level
 * with `&countdown=1`: the countdown must show (countdown.png), ignore a press (also once
 * held on into play), hold the timer, reach playing on GO, and the shader warm-up must
 * finish; on a replay, a tap after the 1 s mark must skip to playing.
 * Perf gate (#188): a level fails past its `scene` ceilings in budgets.json; see sceneBudgetCheck().
 * The speed check holds the first level at top speed on its most banked sampled point:
 * the wind streaks must show and the camera bank ≥ 1° (speed.png).
 * The boss checks summon each finale and shoot it down in phase order: level1's Golden Blimp
 * (level1-boss.png, level1-boss-gondola.png, level1-boss-down.png) and level3's Kraken
 * (level3-boss.png, level3-boss-head.png, level3-boss-down.png); see bossCheck().
 * The pickup check shoots level1's first weapon pickup with a real bullet: the spread gun's badge,
 * a 3-bullet fan with the tinted tracer (level1-pickup.png), pause-safe expiry, reset on restart; see pickupCheck().
 * The scrim check loads level1 with `?audio=scrim` (the score engine, #214, and the arcade SFX, #217); see scrimCheck().
 *
 * All waits are deadline-polled on the hook's frame counter, because software
 * rendering in CI / cloud sessions can run at ~1 fps. The title and each level ride
 * wait --seconds, longer until --min-frames frames have rendered, and fail as a stalled
 * render loop only if those frames haven't arrived by 4× --seconds.
 *
 * Usage:
 *   npm run build && node e2e/smoke.mjs                 # all levels
 *   node e2e/smoke.mjs --levels level1,level5 --seconds 12 --combat-seconds 6
 *   node e2e/smoke.mjs --url https://example.com        # test a deployed site
 *   node e2e/smoke.mjs --mobile                         # + touch playtest on a phone viewport
 *   node e2e/smoke.mjs --mobile --skip-desktop          # only the touch playtest
 *   node e2e/smoke.mjs --dist dist-portal --base /nested/path/ --levels level1   # the portal zip under a sub-path
 *
 * --dist / --base: preview that build folder under that sub-path (`npm run smoke:portal`),
 * proving its relative asset URLs. Every local run fails on a request to another origin,
 * and the title fails unless Lobster and Inter (self-hosted, global.css) loaded.
 *
 * --mobile: iPhone 13-like context (390x844, touch, mobile UA) that taps PLAY,
 * taps level 1, then in portrait and again after rotating to 844x390 landscape
 * taps the canvas 10x at on-screen enemies, each tap offset 15-30 px from the
 * enemy (game time frozen while tapping), and requires the taps to fire and
 * kill through touch aim assist. Checks the camera aspect matches the canvas
 * (±0.01) in portrait, landscape and after rotating back (also on desktop for
 * every level), that HUD elements are inside the viewport and don't overlap in
 * both orientations, then taps Pause. The real PLAY tap unlocks audio, so it
 * also checks the SFX node count stays flat across the taps (no nodes per
 * shot / kill) and the music low-pass ducks while time is frozen and opens at
 * timeScale 1. Saves mobile-level1.png and mobile-level1-landscape.png.
 *
 * Browser: uses Playwright's bundled Chromium if installed; otherwise set
 * SC_CHROME=/path/to/chromium (see scripts/ensure-browser.sh for cloud sessions).
 */
import { chromium, devices } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]?.startsWith('--') ? 'true' : arr[i + 1] ?? 'true'])
    return acc
  }, []),
)
const SECONDS = Number(args.seconds ?? 10)
const OUT = path.resolve(args.out ?? 'e2e-results')
const MIN_FRAMES = Number(args['min-frames'] ?? 10)
// 2-core SwiftShader can drop under 1 fps: a loop is stalled only if MIN_FRAMES miss this deadline.
const FRAME_DEADLINE_MS = SECONDS * 4000
// SwiftShader on a shared 2-core box can take >30s (Playwright's default) to produce
// a frame for the heavier biomes; a slow screenshot is not a game bug.
const SHOT_TIMEOUT = Number(args['shot-timeout'] ?? 120000)
const COMBAT_SECONDS = Number(args['combat-seconds'] ?? 4)
const COMBAT_MIN_FRAMES = Number(args['combat-min-frames'] ?? 4)
// Fixed run seed (enemy spawns) so screenshots are comparable run to run.
const SEED = Number(args.seed ?? 1337)
const DIST = args.dist ?? 'dist'
// Path the build is served under: '/' for the site, a sub-path for the portal zip.
const BASE_PATH = `/${(args.base ?? '/').replace(/^\/+|\/+$/g, '')}`.replace(/\/$/, '')
let preview // module scope so the top-level catch can kill it
fs.mkdirSync(OUT, { recursive: true })

// Console noise that is expected in headless/sandboxed runs and is not a game bug.
const IGNORED = [
  /AudioContext/i,
  /Failed to load resource/i,
  /net::ERR_/i,
  /WebGL.*(performance|GPU stall|ReadPixels)/i,
  /THREE\.WebGLRenderer: .*(extension|precision)/i,
  /Download the React DevTools/i,
]
const ignored = (msg) => IGNORED.some((re) => re.test(msg))

/** Portals forbid requests to other origins (#88); a deployed --url isn't held to it. */
function collectErrors(page, errors) {
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error' && !ignored(m.text())) errors.push(`console: ${m.text()}`)
  })
  if (args.url) return
  page.on('request', (r) => {
    const url = new URL(r.url())
    if (/^(https?|wss?):$/.test(url.protocol) && url.hostname !== 'localhost') errors.push(`other-origin request: ${r.url()}`)
  })
}

async function fontProblems(page) {
  const faces = await page.evaluate(async () => {
    await document.fonts.ready
    return [...document.fonts].map((f) => ({ family: f.family.replace(/["']/g, ''), status: f.status }))
  })
  return ['Lobster', 'Inter']
    .filter((family) => !faces.some((f) => f.family === family && f.status === 'loaded'))
    .map((family) => `${family} font not loaded (${JSON.stringify(faces.filter((f) => f.family === family))})`)
}

const portInUse = async (url) => {
  try {
    await fetch(url)
    return true
  } catch {
    return false
  }
}

/** Kill the whole `npx → sh → vite` process group (killing npx alone leaks vite). */
function stopPreview(proc) {
  try {
    process.kill(-proc.pid, 'SIGTERM')
  } catch {
    proc.kill()
  }
}

async function startPreview() {
  // Never reuse a port something is already serving on: another worktree's
  // preview would make us silently test the wrong build.
  let port, url
  for (let i = 0; i < 20; i++) {
    port = 4173 + Math.floor(Math.random() * 500)
    url = `http://localhost:${port}${BASE_PATH}`
    if (!(await portInUse(`http://localhost:${port}`))) break
  }
  const proc = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort', '--outDir', DIST, '--base', `${BASE_PATH}/`], {
    stdio: ['ignore', 'pipe', 'pipe'],
    // Own process group, so stopPreview() also kills the vite grandchild that
    // npx spawns (proc.kill() alone only stops npx and leaks the server).
    detached: true,
  })
  let exited = false
  proc.on('exit', () => (exited = true))
  for (let i = 0; i < 60 && !exited; i++) {
    try {
      const r = await fetch(`${url}/`)
      if (r.ok && !exited) return { url, proc }
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  stopPreview(proc)
  throw new Error(`vite preview did not start (did you build ${DIST}/?)`)
}

async function launch() {
  const flags = [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required',
    '--no-sandbox',
  ]
  const executablePath = process.env.SC_CHROME || undefined
  return chromium.launch({ headless: true, executablePath, args: flags })
}

/** Pixel stats of a PNG screenshot, computed in the page with a 2D canvas (no deps). */
async function imageStats(page, png) {
  return page.evaluate(async (b64) => {
    const img = new Image()
    img.src = `data:image/png;base64,${b64}`
    await img.decode()
    const c = document.createElement('canvas')
    c.width = 160
    c.height = 90
    const ctx = c.getContext('2d')
    ctx.drawImage(img, 0, 0, c.width, c.height)
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    let sum = 0, sumSq = 0
    const colors = new Set()
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      sum += l
      sumSq += l * l
      colors.add((d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4))
    }
    const n = d.length / 4
    const mean = sum / n
    return { mean, stddev: Math.sqrt(sumSq / n - mean * mean), distinctColors: colors.size }
  }, png.toString('base64'))
}

/** Px an enemy must reach to count as readable (MIN_ENEMY_PX in enemyReadability.ts). */
const READABLE_PX = 12
const MIN_READABLE = 2

const SCENE_BUDGETS = JSON.parse(fs.readFileSync(new URL('../budgets.json', import.meta.url), 'utf8')).scene
const PERF_GATE = !args['no-perf-gate']
const BUDGET_KEYS = [
  ['drawCalls', 'draws'],
  ['objects', 'scene objs'],
  ['triangles', 'scene tris'],
  ['trackObjects', 'track objs'],
  ['trackTriangles', 'track tris'],
]

/** Each ride total past its ceiling; a level whose entry names `knownOver` (an open issue) only warns. */
function sceneBudgetCheck(id, stats) {
  const budget = SCENE_BUDGETS[id]
  if (!budget) return { over: [`no scene budget for ${id} in budgets.json`], knownOver: null }
  const track = trackTotals(stats.scene)
  const measured = {
    drawCalls: stats.drawCalls,
    objects: stats.scene?.objects,
    triangles: stats.scene?.triangles,
    trackObjects: track?.objects,
    trackTriangles: track?.triangles,
  }
  const over = BUDGET_KEYS
    .filter(([key]) => measured[key] > budget[key])
    .map(([key, label]) => `${label}=${measured[key]} (budget ${budget[key]})`)
  return { over, knownOver: budget.knownOver ?? null }
}

/**
 * Readability probe: freeze game time, list on-screen enemies, and save a 4x
 * close-up of the largest one as `<id>-enemy.png` (for eyeballing rim light and
 * contrast). The level loop fails a ride with fewer than MIN_READABLE readable enemies.
 */
async function captureEnemyCloseup(page, id) {
  try {
    await page.evaluate(() => window.__SC_TEST__.setTimeScale(0))
    const f = await page.evaluate(() => window.__SC_TEST__.frames)
    await page.waitForFunction((f0) => window.__SC_TEST__.frames >= f0 + 2, f, { timeout: SHOT_TIMEOUT })
    const list = await page.evaluate(() => window.__SC_TEST__.enemies())
    const summary = {
      onScreen: list.length,
      largestPx: list[0] ? Math.round(list[0].px) : 0,
      readable: list.filter((e) => e.px >= READABLE_PX).length,
      closeup: null,
    }
    // Skip enemies under the HUD (score top-left, timer top-right, mute bottom-right).
    const target = list.find((e) => e.x > 40 && e.x < 1240 && e.y > 100 && e.y < 650)
    if (target) {
      const half = Math.round(Math.min(120, Math.max(40, target.px * 1.5)))
      const x = Math.max(0, Math.min(1280 - 2 * half, Math.round(target.x - half)))
      const y = Math.max(0, Math.min(720 - 2 * half, Math.round(target.y - half)))
      const file = `${id}-enemy.png`
      // Upscale the crop 4x (nearest) via a 2D canvas so small enemies are inspectable.
      const crop = await page.screenshot({ clip: { x, y, width: 2 * half, height: 2 * half }, timeout: SHOT_TIMEOUT })
      const big = await page.evaluate(async (b64) => {
        const img = new Image()
        img.src = `data:image/png;base64,${b64}`
        await img.decode()
        const c = document.createElement('canvas')
        c.width = img.width * 4
        c.height = img.height * 4
        const ctx = c.getContext('2d')
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(img, 0, 0, c.width, c.height)
        return c.toDataURL('image/png').split(',')[1]
      }, crop.toString('base64'))
      fs.writeFileSync(path.join(OUT, file), Buffer.from(big, 'base64'))
      summary.closeup = { file, type: target.type, px: Math.round(target.px), distance: Math.round(target.distance) }
    }
    return summary
  } catch (e) {
    return { error: String(e?.message ?? e).split('\n')[0] }
  } finally {
    // Always resume time, or the combat phase that follows would run frozen.
    await page.evaluate(() => window.__SC_TEST__.setTimeScale(1)).catch(() => {})
  }
}

const getFrames = (page) => page.evaluate(() => window.__SC_TEST__.frames)
const getStats = (page) => page.evaluate(() => window.__SC_TEST__.stats())

/** Poll until `n` more frames have rendered (and at least `minMs` passed), or `maxMs` elapses. */
async function waitFrames(page, n, { minMs = 0, maxMs = 20000, pollMs = 250 } = {}) {
  const start = Date.now()
  const f0 = await getFrames(page)
  let f = f0
  while (Date.now() - start < maxMs) {
    await page.waitForTimeout(pollMs)
    f = await getFrames(page)
    if (f - f0 >= n && Date.now() - start >= minMs) break
  }
  return { frames: f - f0, ms: Date.now() - start }
}

/** Poll `check()` until true; give up once `ms` passed *and* `frames` rendered, or at `ms` + FRAME_DEADLINE_MS. */
async function pollUntil(page, check, { ms, frames = MIN_FRAMES, pollMs = 500 }) {
  const start = Date.now()
  const f0 = await getFrames(page)
  for (;;) {
    if (await check()) return true
    const elapsed = Date.now() - start
    if (elapsed >= ms + FRAME_DEADLINE_MS) return false
    if (elapsed >= ms && (await getFrames(page)) - f0 >= frames) return false
    await page.waitForTimeout(pollMs)
  }
}

/**
 * Play: autofire for a few seconds, then killNearest(5) and screenshot the
 * explosions; then force results and screenshot.
 *
 * Autofire runs first so it has on-screen targets (some levels only have ~4 in
 * view, which killNearest(5) would wipe out). The kills come last because
 * explosions/popups fade after ~1-1.5 s of real time, which at ~1 fps is one or
 * two frames, so they are captured on the very next rendered frame.
 * With `frenzy` (the first level) the kills enter the 5× combo tier: <id>-combat.png
 * must show the "×5 FRENZY" flash during its slow-mo, and on a level with fireworks
 * (Theme Park) the 15+ streak's firework burst, held on screen. The kill's death effect
 * (its enemy type's style, not the default fireball) must be live in the shot.
 */
async function playLevel(page, id, { frenzy = false } = {}) {
  const problems = []
  // Desktop mouse: one real click at the screen centre must fire through pointer input.
  const beforeClick = await getStats(page)
  const vp = page.viewportSize()
  await page.mouse.move(vp.width / 2, vp.height / 2)
  await page.mouse.down()
  await page.mouse.up()
  await waitFrames(page, 1, { maxMs: 4000, pollMs: 40 })
  const atStart = await getStats(page)
  const mouseShots = atStart.shotsFired - beforeClick.shotsFired
  if (mouseShots === 0) problems.push('mouse click fired no shot')
  await page.evaluate(() => window.__SC_TEST__.autoFire(true))
  const fire = await waitFrames(page, COMBAT_MIN_FRAMES, { minMs: COMBAT_SECONDS * 1000, maxMs: COMBAT_SECONDS * 6000 })
  const afterFire = await getStats(page)
  // Hit feedback: stop autofire (so its kicks don't mask the settle check), hold
  // the muzzle flash / hitmarker, then killNearest fires one real shot and
  // resolves the hits. enemy:killed (gold hitmarker, explosion) follows the
  // ~80 ms kill pop, so wait for the kill event before the screenshot.
  const killsBefore = await page.evaluate(() => {
    const s = window.__SC_TEST__
    s.autoFire(false)
    s.holdFeedback = true
    return s.combat.kills
  })
  // With `frenzy`, a 14-kill chain is primed (in the same JS turn) so the first kill enters 5× and its slow-mo.
  const nearestKilled = await page.evaluate((primed) => {
    const s = window.__SC_TEST__
    if (primed) s.primeCombo(primed)
    return s.killNearest(5)
  }, frenzy ? FRENZY_PRIME : 0)
  let killEvents = killsBefore
  let killCheckSkipped = null
  if (nearestKilled > 0) {
    const deadline = Date.now() + 20000
    while (Date.now() < deadline && killEvents <= killsBefore) {
      await page.waitForTimeout(30)
      const c = await page.evaluate(() => ({ kills: window.__SC_TEST__.combat.kills, phase: window.__SC_TEST__.phase() }))
      killEvents = c.kills
      // The level timer is wall-clock; on a ~1 fps runner it can expire here,
      // and an ended level never finishes the kill pop. Can't judge it then.
      if (c.phase !== 'playing') { killCheckSkipped = c.phase; break }
    }
  } else {
    await waitFrames(page, 1, { maxMs: 5000, pollMs: 30 })
  }
  let frenzyShown = null
  if (frenzy && nearestKilled > 0 && !killCheckSkipped) {
    frenzyShown = await page
      .waitForFunction(() => {
        const el = document.querySelector('.hud-frenzy')
        return el && Number(getComputedStyle(el).opacity) > 0.98 && window.__SC_TEST__.stats().timeScale < 0.5
      }, null, { timeout: 20000, polling: 100 })
      .then(() => true, () => false)
  }
  // Theme Park: the primed streak passes 15, so a pair of fireworks goes up (#182); hold a burst in frame.
  let fireworks = await page.evaluate(() => window.__SC_TEST__.fireworks())
  if (fireworks.mounted && frenzy && nearestKilled > 0 && !killCheckSkipped) {
    const burstShown = await page
      .waitForFunction(() => {
        const f = window.__SC_TEST__.fireworks()
        return f.burstsLive > 0 && f.lastBurst?.onScreen
      }, null, { timeout: 30000, polling: 100 })
      .then(() => true, () => false)
    fireworks = await page.evaluate(() => window.__SC_TEST__.fireworks())
    if (!burstShown) problems.push(`no firework burst on screen after a 15+ streak (launched ${fireworks.launched}, bursts ${fireworks.bursts}, live ${fireworks.burstsLive})`)
  }
  // The kill's death effect (#29): its type's style, held mid-spread by holdFeedback.
  let deaths = await page.evaluate(() => window.__SC_TEST__.deaths())
  if (nearestKilled > 0 && !killCheckSkipped && killEvents > killsBefore) {
    const live = await page
      .waitForFunction(() => window.__SC_TEST__.deaths().live > 0, null, { timeout: 20000, polling: 100 })
      .then(() => true, () => false)
    deaths = await page.evaluate(() => window.__SC_TEST__.deaths())
    if (!live) problems.push(`no death effect live on the kill frame (spawned ${deaths.spawned})`)
    else if (deaths.lastStyle === 'bossPart' || deaths.lastStyle === 'custom') problems.push(`kill used the ${deaths.lastStyle} death effect, not its enemy type's`)
  }
  await page.screenshot({ path: path.join(OUT, `${id}-combat.png`), timeout: SHOT_TIMEOUT })
  const combat = await getStats(page)
  if (frenzyShown === false) {
    problems.push(`a kill entering 5× showed no FRENZY flash + slow-mo (combo ${combat.combo}, ×${combat.multiplier}, timeScale ${combat.timeScale.toFixed(2)})`)
  }
  // The gun's aim is checked on the frozen fresh shot (freshShotProblems): here the
  // target and the recoil depend on frame timing (#158).
  const weapon = await weaponProblems(page, 'desktop', { aim: false })
  problems.push(...weapon.problems)
  // Release the hold and let the trauma decay; it must return exactly to 0.
  await page.evaluate(() => { window.__SC_TEST__.holdFeedback = false })
  const settleStart = await getFrames(page)
  const settleDeadline = Date.now() + 30000
  const readShake = () => page.evaluate(() => {
    const s = window.__SC_TEST__
    return { frames: s.frames, ...s.cameraTranslation, trauma: s.cameraTrauma.current, traumaMax: s.cameraTrauma.max, weight: s.cameraWeight }
  })
  let shake = await readShake()
  while (Date.now() < settleDeadline) {
    await page.waitForTimeout(250)
    const now = await readShake()
    shake = now
    if (now.frames - settleStart >= 5 && now.current === 0 && now.trauma === 0) break
  }
  const counts = await page.evaluate(() => window.__SC_TEST__.combat)
  const audio = await audioBurstProblems(page, 'desktop')
  problems.push(...audio.problems)
  const shot = await freshShotProblems(page, id)
  problems.push(...shot.problems)

  await page.evaluate(() => window.__SC_TEST__.endLevel())
  // App uses AnimatePresence mode="wait": the HUD fades out, the results fade in, then the reveal plays.
  const resultsShown = await page
    .waitForFunction(
      () => {
        const el = document.querySelector('.results-screen')
        if (!el || el.getAttribute('data-sequence') !== 'done') return false
        for (let n = el; n; n = n.parentElement) if (Number(getComputedStyle(n).opacity) < 0.98) return false
        return true
      },
      null,
      { timeout: 30000, polling: 250 },
    )
    .then(() => true, () => false)
  // Let the buttons' fade-in settle (a frame can take ~1 s headless) before the screenshot.
  await page.waitForTimeout(1500)
  await page.screenshot({ path: path.join(OUT, `${id}-results.png`), timeout: SHOT_TIMEOUT })
  const end = await getStats(page)
  const results = await resultsScreenProblems(page, end)
  problems.push(...results.problems)

  if (combat.kills === 0) problems.push('no kills (enemies missing or unhittable?)')
  // Only meaningful when something was on screen to aim at.
  if (atStart.onScreenEnemies > 0 && afterFire.shotsFired - atStart.shotsFired === 0) problems.push('autofire never fired at on-screen enemies')
  if (end.phase !== 'results' || !resultsShown) problems.push(`results screen not shown (phase "${end.phase}")`)
  if (nearestKilled > 0 && killEvents <= killsBefore && !killCheckSkipped) problems.push('killNearest hits did not produce an enemy:killed event')
  // Kill feedback is rotation-only (#65): the camera never leaves the track pose.
  if (shake.max > 1e-6) problems.push(`camera translated ${shake.max.toFixed(3)} units off the track pose`)
  if (shake.current !== 0) problems.push(`camera not back on the track pose (${shake.current})`)
  if (shake.traumaMax > 1 + 1e-6) problems.push(`kill trauma ${shake.traumaMax.toFixed(2)}° > 1°`)
  if (shake.trauma !== 0) problems.push(`kill trauma did not decay to 0 (${shake.trauma}°)`)
  const w = shake.weight
  if (w.maxRoll > CAMERA_WEIGHT_CAPS.roll + 1e-6) problems.push(`camera bank ${w.maxRoll.toFixed(2)}° > ${CAMERA_WEIGHT_CAPS.roll}°`)
  if (w.maxPitch > CAMERA_WEIGHT_CAPS.pitch + 1e-6) problems.push(`camera pitch ${w.maxPitch.toFixed(2)}° > ${CAMERA_WEIGHT_CAPS.pitch}°`)
  if (w.maxFovKick > CAMERA_WEIGHT_CAPS.fovKick + 1e-6) problems.push(`speed FOV kick ${w.maxFovKick.toFixed(2)}° > ${CAMERA_WEIGHT_CAPS.fovKick}°`)
  return {
    problems,
    combat: {
      nearestKilled,
      autofireKills: afterFire.kills - atStart.kills,
      shotsFired: afterFire.shotsFired - atStart.shotsFired,
      mouseShots,
      autofireFrames: fire.frames,
      autofireSeconds: fire.ms / 1000,
      liveEnemies: combat.liveEnemies,
      onScreenAtStart: atStart.onScreenEnemies,
      onScreenBeforeKills: afterFire.onScreenEnemies,
      combo: combat.combo,
      multiplier: combat.multiplier,
      frenzy: frenzyShown === null ? null : { shown: frenzyShown, timeScale: combat.timeScale },
      fireworks: fireworks.mounted ? fireworks : null,
      deaths,
      translationMax: shake.max,
      translationIdle: shake.current,
      traumaMaxDeg: shake.traumaMax,
      cameraWeight: w,
      weapon: weapon.box,
      events: counts,
      // Set (to the phase) when the level timed out before the kill event could land.
      killCheckSkipped,
      audioBurst: audio.burst,
      freshShot: shot.result,
    },
    kills: combat.kills,
    score: combat.score,
    results: results.screen,
  }
}

/** Largest screen radius a drawn bullet may have, as a fraction of the canvas height (#165). */
const BULLET_SCREEN_CAP = 0.02

/** Bullets under the cap since load (#165); one frozen real shot must be drawn at the muzzle tip, then <id>-shot.png mid-flight. */
async function freshShotProblems(page, id) {
  const problems = []
  const read = () => page.evaluate(() => ({ bullets: window.__SC_TEST__.bullets(), weapon: window.__SC_TEST__.weapon }))
  const capProblem = (frac, what) => {
    if (frac > BULLET_SCREEN_CAP) problems.push(`${what} covered ${(frac * 100).toFixed(1)}% of the canvas height (cap ${BULLET_SCREEN_CAP * 100}%)`)
  }
  capProblem((await read()).bullets.maxScreenFrac, 'a bullet')
  if ((await page.evaluate(() => window.__SC_TEST__.phase())) !== 'playing') return { problems, result: { skipped: true } }

  await page.evaluate(() => {
    const s = window.__SC_TEST__
    s.setTimeScale(0)
    s.bulletStep = 0
    s.holdFeedback = true
  })
  await page.waitForTimeout(100) // past the pool's 60 ms fire delay
  const fired = await page.evaluate(() => window.__SC_TEST__.fireShot(0.25, 0.15))
  await waitFrames(page, 2, { maxMs: 8000, pollMs: 40 })
  const atMuzzle = await read()
  // Two 40 ms steps of flight, then freeze again for the screenshot.
  await page.evaluate(() => { window.__SC_TEST__.bulletStep = 0.04 })
  await waitFrames(page, 2, { maxMs: 8000, pollMs: 40 })
  await page.evaluate(() => { window.__SC_TEST__.bulletStep = 0 })
  await waitFrames(page, 1, { maxMs: 8000, pollMs: 40 })
  await page.screenshot({ path: path.join(OUT, `${id}-shot.png`), timeout: SHOT_TIMEOUT })
  const inFlight = await read()
  const jump = await aimJumpCheck(page, read)
  problems.push(...jump.problems)
  await page.evaluate(() => {
    const s = window.__SC_TEST__
    s.bulletStep = null
    s.holdFeedback = false
    s.setTimeScale(1)
  })

  const { bullets, weapon } = atMuzzle
  const result = {
    fired, muzzleFrac: bullets.screenFrac, flightFrac: inFlight.bullets.screenFrac, maxScreenFrac: inFlight.bullets.maxScreenFrac,
    tipDistPx: null, aimErrorDeg: null, aimJump: jump.result,
  }
  // Gun aim (#65) on this shot: fixed aim point, time frozen, recoil held at its peak, so the angle is repeatable (#158).
  if (fired && weapon) {
    const p = weaponAimProblem(weapon, 'desktop')
    if (p) problems.push(p)
    result.aimErrorDeg = weapon.aimErrorDeg
  }
  if (!fired) problems.push('fresh shot: fireShot() fired nothing')
  else if (!bullets.newest) problems.push('fresh shot: no bullet drawn in front of the camera')
  else if (weapon) {
    result.tipDistPx = Math.hypot(bullets.newest.x - weapon.tipX, bullets.newest.y - weapon.tipY)
    const maxPx = 0.08 * Math.min(weapon.width, weapon.height)
    if (result.tipDistPx > maxPx) problems.push(`fresh shot drawn ${result.tipDistPx.toFixed(0)} px from the muzzle tip (> ${maxPx.toFixed(0)})`)
  }
  capProblem(bullets.screenFrac, 'the fresh shot at the muzzle')
  capProblem(inFlight.bullets.maxScreenFrac, 'a bullet in flight')
  return { problems, result }
}

/** Far side of the screen from the fixed-point shot (0.25, 0.15): above the muzzle, so the aim check applies. */
const AIM_JUMP_SHOT = { x: -0.6, y: 0.55 }

/** A far-side shot without `holdFeedback` (#79); game time stays frozen, so only the shot-frame snap can turn the gun. */
async function aimJumpCheck(page, read) {
  await page.evaluate(() => { window.__SC_TEST__.holdFeedback = false })
  await waitFrames(page, 1, { maxMs: 8000, pollMs: 40 })
  const before = (await read()).weapon
  await page.waitForTimeout(300) // past every gun's fire interval
  const fired = await page.evaluate(({ x, y }) => window.__SC_TEST__.fireShot(x, y), AIM_JUMP_SHOT)
  await waitFrames(page, 2, { maxMs: 8000, pollMs: 40 })
  const after = (await read()).weapon
  const problems = []
  const result = { fired, jumpDeg: null, aimErrorDeg: null }
  if (!fired) problems.push('aim jump: fireShot() fired nothing')
  else if (before && after) {
    const barrel = (w) => Math.atan2(w.tipY - w.pivotY, w.tipX - w.pivotX)
    const turn = Math.abs(((barrel(after) - barrel(before) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI)
    result.jumpDeg = turn * (180 / Math.PI)
    const p = weaponAimProblem(after, 'aim jump (no holdFeedback)')
    if (p) problems.push(p)
    result.aimErrorDeg = after.aimErrorDeg
  }
  return { problems, result }
}

async function resultsScreenProblems(page, stats) {
  const screen = await page.evaluate(() => {
    const el = document.querySelector('.results-screen')
    if (!el) return null
    const rows = Object.fromEntries(
      [...el.querySelectorAll('.results-stat')].map((r) => [r.children[0].textContent, r.children[1].textContent]),
    )
    const buttons = [...el.querySelectorAll('.results-actions button')]
      .filter((b) => b.getBoundingClientRect().width > 0)
      .map((b) => b.textContent)
    const stars = [...el.querySelectorAll('.results-star-earned')].filter((s) => Number(getComputedStyle(s).opacity) > 0.9).length
    const s = window.__SC_TEST__
    const levelName = s.levels().find((l) => l.id === s.stats().currentLevel)?.name ?? null
    return {
      rows, buttons, stars, levelName, shareText: s.shareText(),
      score: el.querySelector('.results-score-value')?.textContent ?? '', text: el.textContent,
    }
  })
  const problems = []
  if (!screen) return { problems: ['results screen missing'], screen }
  const { text, ...shown } = screen
  problems.push(...(await resultsActionsProblems(page, 'desktop')))
  // #87: the shared line can't drift from the run (score, stars, level) or lose its campaign link.
  const shareRe = /^I scored ([\d,]+) ([★☆]{3}) on (.+) in ShooterCoaster 🎢 — beat me: (\S+)$/u
  const share = shareRe.exec(screen.shareText ?? '')
  if (!share) problems.push(`share text ${JSON.stringify(screen.shareText)} is not in the share format`)
  else {
    if (share[1] !== screen.score) problems.push(`share score ${share[1]} != results score ${screen.score}`)
    if ((share[2].match(/★/g) ?? []).length !== screen.stars) problems.push(`share stars ${share[2]} != ${screen.stars} earned`)
    if (share[3] !== screen.levelName) problems.push(`share level "${share[3]}" != "${screen.levelName}"`)
    if (share[4] !== SHARE_URL) problems.push(`share link ${share[4]} != ${SHARE_URL}`)
  }
  // Headless Chromium has no share sheet, so a real click takes the clipboard path and confirms it on the button.
  const shareButton = page.locator('.results-share')
  if (await shareButton.count()) {
    await shareButton.click({ timeout: 10000 }).catch((e) => problems.push(`click Share: ${e.message}`))
    const copied = await page
      .waitForFunction(() => document.querySelector('.results-share')?.textContent === 'Copied!', null, { timeout: 10000, polling: 100 })
      .then(() => true, () => false)
    const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null)
    if (!copied) problems.push('clicking Share did not show "Copied!"')
    else if (clip !== null && clip !== screen.shareText) problems.push(`clipboard ${JSON.stringify(clip)} != shareText()`)
    shown.copied = copied
  }
  if (/NaN|undefined|Infinity/.test(text)) problems.push(`results screen shows NaN/undefined: "${text}"`)
  for (const label of ['Kills', 'Accuracy', 'Best combo', 'Time left']) {
    if (!(label in screen.rows)) problems.push(`results screen has no "${label}" row`)
  }
  if (screen.rows.Kills && !screen.rows.Kills.startsWith(`${stats.kills} /`)) problems.push(`results kills "${screen.rows.Kills}" != ${stats.kills}`)
  if (stats.shotsFired > 0 && !/^\d+%$/.test(screen.rows.Accuracy ?? '')) problems.push(`results accuracy "${screen.rows.Accuracy}" with ${stats.shotsFired} shots`)
  for (const label of ['Levels', 'Replay', 'Share']) {
    if (!screen.buttons.includes(label)) problems.push(`results buttons ${JSON.stringify(screen.buttons)} lack ${label}`)
  }
  if (screen.score.replace(/,/g, '') !== String(stats.score)) problems.push(`results score "${screen.score}" != ${stats.score}`)
  return { problems, screen: shown }
}

/** The results-screen share link (#87, src/ui/share.ts). */
const SHARE_URL = 'https://scoaster.com/go/share?utm_source=share&utm_medium=organic&utm_campaign=results'

/** Results buttons inside the viewport, none overlapping another, each at least the 44 px touch target. */
async function resultsActionsProblems(page, label) {
  const r = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('.results-actions button')]
      .map((b) => ({ name: b.textContent, r: b.getBoundingClientRect() }))
      .filter((b) => b.r.width > 0)
    const screen = document.querySelector('.results-screen')
    return {
      vw: window.innerWidth,
      vh: window.innerHeight,
      hScroll: screen ? screen.scrollWidth > screen.clientWidth : true,
      boxes: boxes.map((b) => ({ name: b.name, left: b.r.left, top: b.r.top, right: b.r.right, bottom: b.r.bottom })),
    }
  })
  const problems = []
  if (r.hScroll) problems.push(`${label}: the results screen scrolls sideways`)
  for (const [i, a] of r.boxes.entries()) {
    if (a.left < 0 || a.top < 0 || a.right > r.vw || a.bottom > r.vh)
      problems.push(`${label}: results button ${a.name} leaves the ${r.vw}x${r.vh} viewport`)
    if (a.bottom - a.top < 44) problems.push(`${label}: results button ${a.name} under the 44 px touch target`)
    for (const b of r.boxes.slice(i + 1)) {
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom)
        problems.push(`${label}: results buttons ${a.name} and ${b.name} overlap`)
    }
  }
  return problems
}

const MOBILE_LEVEL = 'level1'
/** HUD the first-person weapon must stay clear of (#65). */
const WEAPON_HUD_SELECTORS = '.hud-panel, .hud-combo, .hud-pause-button, .mute-button'
/** Max angle between the barrel and the tracer on screen (#65). */
const WEAPON_MAX_AIM_DEG = 25
/** Caps on the coaster camera weight (#123): MAX_BANK_DEG / MAX_PITCH_DEG in
 *  src/track/cameraRig.ts and SPEED_FOV_DEG + DROP_FOV_DEG in src/track/cameraFov.ts. */
const CAMERA_WEIGHT_CAPS = { roll: 8, pitch: 3, fovKick: 8 }
/** Chain primed before the first level's kills, so the next kill enters the 5× tier (src/combat/comboTiers.ts). */
const FRENZY_PRIME = 14
const HUD_SELECTORS = ['.hud-score', '.hud-kills', '.hud-timer', '.hud-combo', '.hud-pause-button', '.mute-button']

/** Wait until `selector` exists, has a size, and it and its ancestors are fully faded in. */
function waitVisible(page, selector, timeout = 30000) {
  return page
    .waitForFunction(
      (sel) => {
        const el = document.querySelector(sel)
        if (!el) return false
        for (let n = el; n; n = n.parentElement) if (Number(getComputedStyle(n).opacity) < 0.98) return false
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      },
      selector,
      { timeout, polling: 250 },
    )
    .then(() => true, () => false)
}

/**
 * First-person weapon (#65): must be on screen, its muzzle tip inside the
 * viewport, anchored in the lower-right, never covering the screen centre
 * (where the crosshair usually is), and (unless `aim` is false) pointing along
 * the last shot's tracer.
 */
async function weaponProblems(page, label, { aim = true } = {}) {
  const { box, hud } = await page.evaluate((sels) => {
    const w = window.__SC_TEST__.weapon
    const hud = []
    for (const el of document.querySelectorAll(sels)) {
      if (Number(getComputedStyle(el).opacity) < 0.05) continue // e.g. hidden combo meter
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) hud.push({ sel: el.className, x: r.left, y: r.top, w: r.width, h: r.height })
    }
    return { box: w ? { ...w } : null, hud }
  }, WEAPON_HUD_SELECTORS)
  const problems = []
  if (!box) return { problems: [`${label}: weapon view-model not reported`], box }
  const { width: vw, height: vh } = box
  if (!box.visible) problems.push(`${label}: weapon hidden`)
  if (box.maxX < 0 || box.minX > vw || box.maxY < 0 || box.minY > vh) problems.push(`${label}: weapon off screen`)
  if (box.tipX < 0 || box.tipX > vw || box.tipY < 0 || box.tipY > vh)
    problems.push(`${label}: muzzle tip off screen (${box.tipX.toFixed(0)},${box.tipY.toFixed(0)})`)
  if (box.minX < vw / 2 && box.maxX > vw / 2 && box.minY < vh / 2 && box.maxY > vh / 2)
    problems.push(`${label}: weapon covers the screen centre`)
  if ((box.minX + box.maxX) / 2 < vw / 2 || (box.minY + box.maxY) / 2 < vh / 2)
    problems.push(`${label}: weapon not in the lower-right quadrant`)
  if (aim) {
    const p = weaponAimProblem(box, label)
    if (p) problems.push(p)
  }
  // The projected bounding box is conservative (larger than the silhouette).
  for (const r of hud)
    if (box.minX < r.x + r.w && r.x < box.maxX && box.minY < r.y + r.h && r.y < box.maxY)
      problems.push(`${label}: weapon overlaps HUD .${String(r.sel).split(' ')[0]}`)
  box.hudOverlaps = problems.filter((p) => p.includes('overlaps HUD')).length
  return { problems, box }
}

/**
 * The shot must read as leaving the barrel: on a held frame, the tracer
 * (tip → last shot) runs within WEAPON_MAX_AIM_DEG of the barrel (pivot → tip)
 * for any aim point above the muzzle and not right on top of it. Sets
 * `box.aimErrorDeg`. Only meaningful when nothing moved between the shot and the
 * read (game time frozen, feedback held), or the angle is frame-timing noise (#158).
 */
function weaponAimProblem(box, label) {
  const barrel = Math.atan2(box.tipY - box.pivotY, box.tipX - box.pivotX)
  const shot = Math.atan2(box.shotY - box.tipY, box.shotX - box.tipX)
  box.aimErrorDeg = Math.abs(((shot - barrel + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) * (180 / Math.PI)
  const shotFar = Math.hypot(box.shotX - box.tipX, box.shotY - box.tipY) > 0.1 * Math.min(box.width, box.height)
  if (box.shotY < box.tipY && shotFar && box.aimErrorDeg > WEAPON_MAX_AIM_DEG)
    return `${label}: tracer leaves the barrel ${box.aimErrorDeg.toFixed(0)}° off its direction (> ${WEAPON_MAX_AIM_DEG}°)`
  return null
}

/** HUD layout problems: elements missing, outside the viewport, or overlapping each other. */
async function hudLayoutProblems(page, label, selectors = HUD_SELECTORS) {
  const { rects, vw, vh } = await page.evaluate((sels) => {
    const rects = sels.map((sel) => {
      const el = document.querySelector(sel)
      if (!el) return { sel, missing: true }
      // Text extent, not the block box (a block div spans its whole row).
      let r
      if (el.matches('button')) r = el.getBoundingClientRect()
      else {
        const range = document.createRange()
        range.selectNodeContents(el)
        r = range.getBoundingClientRect()
      }
      return { sel, x: r.left, y: r.top, w: r.width, h: r.height }
    })
    return { rects, vw: window.innerWidth, vh: window.innerHeight }
  }, selectors)
  const problems = []
  for (const r of rects) {
    if (r.missing) {
      problems.push(`${label}: ${r.sel} missing`)
      continue
    }
    if (r.x < 0 || r.y < 0 || r.x + r.w > vw + 0.5 || r.y + r.h > vh + 0.5)
      problems.push(`${label}: ${r.sel} outside viewport (${r.x.toFixed(0)},${r.y.toFixed(0)} ${r.w.toFixed(0)}x${r.h.toFixed(0)})`)
  }
  const placed = rects.filter((r) => !r.missing)
  for (let i = 0; i < placed.length; i++)
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i]
      const b = placed[j]
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)
        problems.push(`${label}: ${a.sel} overlaps ${b.sel}`)
    }
  return { problems, rects }
}

// ── Camera aspect + offset touch taps (issue #66) ──

/** Camera aspect must match the canvas on screen (±0.01), or the world is squashed. */
async function aspectProblems(page, label) {
  const view = await page.evaluate(() => window.__SC_TEST__.view?.() ?? null)
  if (!view || view.cameraAspect == null) return { view, problems: [`${label}: camera view unavailable`] }
  const off = Math.abs(view.cameraAspect - view.canvasAspect)
  return {
    view,
    problems: off > 0.01
      ? [`${label}: camera aspect ${view.cameraAspect.toFixed(3)} != canvas ${view.canvasAspect.toFixed(3)} (world squashed)`]
      : [],
  }
}

const TAP_COUNT = 10
const TAP_MAX_OFFSET = 30

/**
 * Tap TAP_COUNT times near the nearest on-screen enemy, each tap deliberately
 * offset 15-30 px from its centre (a fingertip is not a crosshair), and require
 * kills. Game time is frozen while tapping so the check measures aim + touch
 * assist rather than how far a target moves during one ~1 fps software frame;
 * bullets still fly (they run on real time). Time is resumed afterwards so the
 * kill pops finish. Leaves time running (scale 1).
 */
async function offsetTapKills(page, label) {
  const freezeAndSettle = async () => {
    await page.evaluate(() => window.__SC_TEST__.setTimeScale(0))
    await waitFrames(page, 2, { maxMs: 8000, pollMs: 40 })
  }
  await freezeAndSettle()
  const vp = page.viewportSize()
  const before = await getStats(page)
  const hitsBefore = await page.evaluate(() => window.__SC_TEST__.combat.hits)
  let tapsOnEnemies = 0
  let maxOffset = 0
  for (let i = 0; i < TAP_COUNT; i++) {
    const [pt] = await page.evaluate(() => window.__SC_TEST__.enemyScreenPoints(1))
    let x = vp.width / 2
    let y = vp.height / 2
    if (pt) {
      tapsOnEnemies++
      const r = TAP_MAX_OFFSET * (0.5 + 0.25 * (i % 3)) // 15, 22.5, 30 px
      const a = i * 2.39996 // golden angle: offsets all around the target
      x = pt.x + r * Math.cos(a)
      y = pt.y + r * Math.sin(a)
      maxOffset = Math.max(maxOffset, r)
    }
    // Keep taps on the canvas, off the HUD buttons in the bottom corners.
    x = Math.min(Math.max(x, 8), vp.width - 8)
    y = Math.min(Math.max(y, 8), vp.height - 80)
    await page.touchscreen.tap(x, y)
    await waitFrames(page, 1, { minMs: 80, maxMs: 4000, pollMs: 40 })
  }
  const afterTaps = await getStats(page)
  // Bullets need a few frames to reach the (frozen) targets.
  const hitDeadline = Date.now() + 15000
  let hits = hitsBefore
  while (Date.now() < hitDeadline) {
    await waitFrames(page, 1, { maxMs: 4000, pollMs: 60 })
    hits = await page.evaluate(() => window.__SC_TEST__.combat.hits)
    if (hits - hitsBefore >= Math.min(3, tapsOnEnemies)) break
  }
  // Resume time so the hit enemies finish their kill pop (enemy:killed).
  await page.evaluate(() => window.__SC_TEST__.setTimeScale(1))
  const killDeadline = Date.now() + 15000
  let s = await getStats(page)
  while (Date.now() < killDeadline && hits > hitsBefore && s.kills === before.kills && s.phase === 'playing') {
    await waitFrames(page, 1, { maxMs: 4000, pollMs: 60 })
    s = await getStats(page)
  }
  const result = {
    taps: TAP_COUNT,
    tapsOnEnemies,
    maxOffsetPx: maxOffset,
    tapShots: afterTaps.shotsFired - before.shotsFired,
    tapHits: hits - hitsBefore,
    tapKills: s.kills - before.kills,
  }
  const problems = []
  if (result.tapShots === 0) problems.push(`${label}: ${TAP_COUNT} taps fired no shots (touch input broken?)`)
  else if (tapsOnEnemies > 0 && result.tapKills === 0)
    problems.push(`${label}: ${TAP_COUNT} taps up to ${TAP_MAX_OFFSET} px off enemies got no kills (${result.tapHits} hits)`)
  return { result, problems }
}

/** Tone scheduling stress (#115); page errors are counted by the caller. */
async function audioBurstProblems(page, label) {
  const burst = await page.evaluate(() => window.__SC_TEST__.audioBurst(20, 10))
  const problems = []
  if (burst.lateScheduleErrors > 0)
    problems.push(`${label}: ${burst.lateScheduleErrors}/10 late music note pairs threw a Tone scheduling error`)
  if (burst.dropped > 0)
    problems.push(`${label}: ${burst.dropped} sound(s) dropped by an audio error (${burst.lastDrop?.split('\n')[0]})`)
  return { burst, problems }
}

/** The hook's spawnDigest() once it is set and differs from `prev` (null on timeout). */
async function nextSpawnDigest(page, prev) {
  return page
    .waitForFunction((p) => {
      const d = window.__SC_TEST__.spawnDigest()
      return d !== null && d !== p ? d : null
    }, prev, { timeout: 60000, polling: 250 })
    .then((h) => h.jsonValue())
    .catch(() => null)
}

/** Restart `level.id` on a fresh page with SEED, SEED + 1, then SEED again. */
async function seedCheck(page, level) {
  const start = (seed) => page.evaluate(([lid, s]) => window.__SC_TEST__.startLevel(lid, s), [level.id, seed])
  await start(SEED)
  const reloaded = await nextSpawnDigest(page, null)
  await start(SEED + 1)
  const other = await nextSpawnDigest(page, reloaded)
  await start(SEED)
  const again = await nextSpawnDigest(page, other)
  const problems = []
  if (reloaded !== level.spawnDigest) problems.push(`seed ${SEED} spawned differently after a reload (${reloaded} vs ${level.spawnDigest})`)
  if (!other) problems.push(`seed ${SEED + 1} gave the same spawns as seed ${SEED}`)
  if (again !== level.spawnDigest) problems.push(`restarting with seed ${SEED} gave ${again}, not ${level.spawnDigest}`)
  return {
    id: 'seed-check',
    ok: problems.length === 0,
    problems,
    seedCheck: { level: level.id, digest: level.spawnDigest, reloaded, other, again },
  }
}

/** Fake a tab hide / show (headless Chromium can't); returns stats read in the same JS turn, so no frame lands in between. */
const setHidden = (page, hidden) => page.evaluate((h) => {
  const stats = window.__SC_TEST__.stats()
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') })
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => h })
  document.dispatchEvent(new Event('visibilitychange'))
  return stats
}, hidden)

const waveAnnounces = (page) => page.evaluate(() => window.__SC_TEST__.waveEvents.filter((e) => e.kind === 'announce').length)

/** The frozen-world probe the pause checks compare: ride position, live enemies, the wave schedule, the pause mix. */
const frozenState = (page) => page.evaluate(() => {
  const t = window.__SC_TEST__
  return {
    phase: t.phase(),
    ride: t.rideProgress,
    live: t.stats().liveEnemies,
    wave: t.nextWave(),
    pauseMix: t.audio().pauseMix,
    counting: !!document.querySelector('.countdown-step'),
  }
})

/** Forward track distance from a to b as a fraction (the ride wraps at 1). */
const rideAdvance = (a, b) => (((b - a) % 1) + 1) % 1

/**
 * Leaving the tab pauses the run and drops the trigger; nothing drains or resets the timer (#118), the kills or the enemies (#198).
 * The world is frozen while paused (#133): the ride, the live enemies and the next wave's due time hold over 5 s and through
 * the Resume countdown; then the ride goes on from the same spot and the next wave comes at its original level time (#152).
 */
async function hiddenPauseCheck(page, levelId) {
  await page.evaluate(([lid, seed]) => window.__SC_TEST__.startLevel(lid, seed), [levelId, SEED])
  await waitFrames(page, 3, { minMs: 3000, maxMs: 30000 })
  await page.evaluate(() => window.__SC_TEST__.killNearest(2))
  await waitFrames(page, 2, { maxMs: 20000 })
  const announcesBefore = await waveAnnounces(page)
  const vp = page.viewportSize()
  await page.mouse.move(vp.width / 2, vp.height / 2)
  await page.mouse.down()
  const heldBefore = await page.evaluate(() => {
    window.__SC_TEST__.primeCombo(3)
    return window.__SC_TEST__.triggerHeld()
  })
  const before = await setHidden(page, true)
  const frozenAt = await frozenState(page)
  const heldAfter = await page.evaluate(() => window.__SC_TEST__.triggerHeld())
  await page.mouse.up()
  const hiddenPhase = await page.evaluate(() => window.__SC_TEST__.phase())
  await waitFrames(page, 3, { minMs: 5000, maxMs: 30000 })
  const whileHidden = await getStats(page)
  const frozenAfter = await frozenState(page)
  await setHidden(page, false)
  await waitFrames(page, 2, { maxMs: 10000 })
  const shownPhase = await page.evaluate(() => window.__SC_TEST__.phase())
  const pausedStats = await getStats(page)
  const resumedAt = Date.now()
  const resumeClicked = await page
    .getByRole('button', { name: 'Resume' })
    .click({ timeout: 30000 })
    .then(() => true, () => false)
  // Through the Resume countdown the run stays paused and frozen; GO hands it back to `playing`.
  const countdownSamples = []
  for (let i = 0; i < 100; i++) {
    const f = await frozenState(page)
    if (f.phase !== 'paused') break
    countdownSamples.push(f)
    await page.waitForTimeout(100)
  }
  // The next wave after the pause must arrive at its own level time: on the first ticks after Resume if it was
  // already told when the run paused, else at its due time ('ended' if the level ran out first).
  const due = frozenAt.wave?.due ?? null
  const waveArrival = due === null
    ? null
    : await page
      .waitForFunction(
        (d) => {
          const w = window.__SC_TEST__.nextWave()
          if (w && w.due !== d) return { levelTime: w.levelTime }
          return window.__SC_TEST__.phase() === 'results' ? 'ended' : null
        },
        due,
        { timeout: 90000, polling: 100 },
      )
      .then((h) => h.jsonValue(), () => null)
  await waitFrames(page, 3, { minMs: 3000, maxMs: 30000 })
  const resumed = await getStats(page)
  const resumedFrozen = await frozenState(page)
  const resumedSeconds = (Date.now() - resumedAt) / 1000
  const waveArrived = (await waveAnnounces(page)) > announcesBefore
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  const blurPhase = await page.evaluate(() => window.__SC_TEST__.phase())

  const problems = []
  if (before.phase !== 'playing') problems.push(`level not playing before hiding ("${before.phase}")`)
  if (!heldBefore) problems.push('mouse down did not hold the trigger')
  if (heldAfter) problems.push('trigger still held after the tab was hidden')
  if (hiddenPhase !== 'paused') problems.push(`hiding the tab left the phase "${hiddenPhase}", not paused`)
  if (whileHidden.timeRemaining !== before.timeRemaining)
    problems.push(`timer moved while hidden (${before.timeRemaining.toFixed(2)} -> ${whileHidden.timeRemaining.toFixed(2)})`)
  if (frozenAfter.ride !== frozenAt.ride) problems.push(`the ride moved while paused (track ${frozenAt.ride.toFixed(4)} -> ${frozenAfter.ride.toFixed(4)})`)
  if (frozenAfter.live !== frozenAt.live) problems.push(`live enemies changed while paused (${frozenAt.live} -> ${frozenAfter.live})`)
  if (JSON.stringify(frozenAfter.wave) !== JSON.stringify(frozenAt.wave))
    problems.push(`the wave schedule moved while paused (${JSON.stringify(frozenAt.wave)} -> ${JSON.stringify(frozenAfter.wave)})`)
  if (!frozenAt.pauseMix || !frozenAfter.pauseMix) problems.push('the pause mix (music down, SFX silent) was off while paused')
  if (shownPhase !== 'paused') problems.push(`showing the tab again auto-resumed (phase "${shownPhase}")`)
  // The combo window runs on game time: a pause, however long, never breaks the chain.
  if (before.combo < 3 || whileHidden.combo !== before.combo || pausedStats.combo !== before.combo)
    problems.push(`the pause changed the combo (${before.combo} -> ${whileHidden.combo} hidden -> ${pausedStats.combo} shown)`)
  if (!resumeClicked) problems.push('Resume button not clickable')
  if (!countdownSamples.some((f) => f.counting)) problems.push('Resume showed no Ready / GO countdown')
  const movedInCountdown = countdownSamples.find((f) => f.ride !== frozenAt.ride)
  if (movedInCountdown) problems.push(`the ride moved during the Resume countdown (track ${frozenAt.ride.toFixed(4)} -> ${movedInCountdown.ride.toFixed(4)})`)
  if (resumed.phase !== 'playing') problems.push(`Resume left the phase "${resumed.phase}"`)
  if (resumedFrozen.pauseMix) problems.push('the pause mix stayed on after Resume')
  const advance = rideAdvance(frozenAt.ride, resumedFrozen.ride)
  if (!(advance > 0 && advance < 0.5))
    problems.push(`the ride did not go on from where it paused (track ${frozenAt.ride.toFixed(4)} -> ${resumedFrozen.ride.toFixed(4)})`)
  if (resumed.timeRemaining > before.timeRemaining)
    problems.push(`timer reset on resume (${before.timeRemaining.toFixed(2)} -> ${resumed.timeRemaining.toFixed(2)})`)
  // timeRemaining is only stored on whole-second crossings, hence the 1 s slack.
  if (resumed.timeRemaining < before.timeRemaining - resumedSeconds - 1)
    problems.push(`timer jumped by the paused time (${before.timeRemaining.toFixed(2)} -> ${resumed.timeRemaining.toFixed(2)} after ${resumedSeconds.toFixed(1)} s of play)`)
  if (resumed.kills < before.kills) problems.push(`kills reset across the pause (${before.kills} -> ${resumed.kills})`)
  if (!waveArrived && resumed.liveEnemies > before.liveEnemies)
    problems.push(`enemies came back across the pause (${before.liveEnemies} -> ${resumed.liveEnemies} live)`)
  if (due === null) problems.push('no wave still due when the tab was hidden (nextWave)')
  else if (!waveArrival) problems.push(`the wave due at ${due} s of level time never arrived after Resume`)
  else if (waveArrival !== 'ended') {
    // One or two slow software-GL frames of slack; a schedule on wall time would be late by the whole pause (≥ 6 s).
    const latest = Math.max(due, frozenAt.wave.levelTime) + 3
    if (!(waveArrival.levelTime >= due && waveArrival.levelTime <= latest))
      problems.push(`the wave due at ${due} s of level time (paused at ${frozenAt.wave.levelTime.toFixed(2)} s) arrived at ${waveArrival.levelTime.toFixed(2)} s`)
  }
  if (blurPhase !== 'paused') problems.push(`window blur left the phase "${blurPhase}", not paused`)
  return {
    id: 'hidden-pause',
    ok: problems.length === 0,
    problems,
    hiddenPause: {
      level: levelId,
      before: before.timeRemaining,
      whileHidden: whileHidden.timeRemaining,
      resumed: resumed.timeRemaining,
      resumedSeconds,
      kills: [before.kills, resumed.kills],
      liveEnemies: [before.liveEnemies, resumed.liveEnemies],
      combo: [before.combo, whileHidden.combo, pausedStats.combo],
      ride: [frozenAt.ride, frozenAfter.ride, resumedFrozen.ride],
      wave: { due, pausedAt: frozenAt.wave?.levelTime ?? null, arrivedAt: waveArrival?.levelTime ?? waveArrival },
      heldBefore,
      heldAfter,
    },
  }
}

/** The pause card must sit inside the viewport with no sideways scroll and 44 px buttons; also returns its title and the focused button. */
async function pauseCardLayout(page) {
  const r = await page.evaluate(() => {
    const card = document.querySelector('.pause-card')
    const root = document.querySelector('.pause-menu')
    const b = card?.getBoundingClientRect()
    const buttons = [...document.querySelectorAll('.pause-actions button')].map((el) => el.getBoundingClientRect())
    const active = document.activeElement
    return {
      rect: b ? { left: Math.round(b.left), top: Math.round(b.top), right: Math.round(b.right), bottom: Math.round(b.bottom) } : null,
      vw: window.innerWidth,
      vh: window.innerHeight,
      hScroll: root ? root.scrollWidth > root.clientWidth : true,
      buttons: buttons.length,
      smallButtons: buttons.filter((x) => x.height < 44).length,
      title: card?.querySelector('h2')?.textContent ?? null,
      focused: active?.closest('.pause-actions') ? active.textContent.trim() : null,
    }
  })
  const problems = []
  if (!r.rect) problems.push('no pause card')
  else if (r.rect.left < 0 || r.rect.top < 0 || r.rect.right > r.vw || r.rect.bottom > r.vh)
    problems.push(`the pause card (${r.rect.left},${r.rect.top})-(${r.rect.right},${r.rect.bottom}) leaves the ${r.vw}x${r.vh} viewport`)
  if (r.hScroll) problems.push('the pause menu scrolls sideways')
  if (r.buttons !== 4) problems.push(`${r.buttons} pause buttons, expected Resume / Restart / Settings / Quit`)
  if (r.smallButtons) problems.push(`${r.smallButtons} pause button(s) under the 44 px touch target`)
  return { ...r, problems }
}

/**
 * The pause menu (#36), opened through the hook: a card inside the viewport with the level name, Resume focused (pause.png);
 * ArrowDown moves focus, Esc resumes through the Ready / GO countdown, and Restart starts the level over.
 */
async function pauseMenuCheck(page, levelId) {
  const problems = []
  await page.evaluate(([lid, seed]) => window.__SC_TEST__.startLevel(lid, seed), [levelId, SEED])
  await waitFrames(page, 3, { minMs: 3000, maxMs: 30000 })
  const name = await page.evaluate((id) => window.__SC_TEST__.levels().find((l) => l.id === id)?.name ?? null, levelId)
  await page.evaluate(() => window.__SC_TEST__.killNearest(1))
  await page.evaluate(() => window.__SC_TEST__.setPhase('paused'))
  if (!(await waitVisible(page, '.pause-card', 30000))) return { id: 'pause-menu', problems: ['the pause card never showed'] }
  // The card fades and the backdrop blurs in; let a frame or two land under it.
  await waitFrames(page, 1, { minMs: 400, maxMs: 8000 })
  const card = await pauseCardLayout(page)
  problems.push(...card.problems.map((p) => `desktop 1280x720: ${p}`))
  if (name && card.title !== name) problems.push(`the card is titled "${card.title}", not the level name "${name}"`)
  if (card.focused !== 'Resume') problems.push(`"${card.focused}" has focus when the menu opens, not Resume`)
  await page.screenshot({ path: path.join(OUT, 'pause.png'), timeout: SHOT_TIMEOUT })
  await page.keyboard.press('ArrowDown')
  const afterArrow = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? null)
  if (afterArrow !== 'Restart') problems.push(`ArrowDown moved focus to "${afterArrow}", not Restart`)
  await page.keyboard.press('Escape')
  const resumed = await page
    .waitForFunction(() => window.__SC_TEST__.phase() === 'playing', null, { timeout: 15000, polling: 100 })
    .then(() => true, () => false)
  if (!resumed) problems.push('Esc did not resume the run')

  await waitFrames(page, 2, { maxMs: 10000 })
  const rideBefore = await page.evaluate(() => window.__SC_TEST__.rideProgress)
  const levelTimeBefore = await page.evaluate(() => window.__SC_TEST__.nextWave()?.levelTime ?? 0)
  await page.evaluate(() => window.__SC_TEST__.setPhase('paused'))
  await waitVisible(page, '.pause-card', 30000)
  const restarted = await page
    .getByRole('button', { name: 'Restart' })
    .click({ timeout: 30000 })
    .then(() => true, () => false)
  await waitFrames(page, 1, { maxMs: 10000 })
  const after = await page.evaluate(() => ({ ...window.__SC_TEST__.stats(), ride: window.__SC_TEST__.rideProgress }))
  const levelTime = await page.evaluate(() => window.__SC_TEST__.nextWave()?.levelTime ?? null)
  if (!restarted) problems.push('Restart button not clickable')
  if (after.currentLevel !== levelId) problems.push(`Restart opened "${after.currentLevel}", not ${levelId}`)
  if (after.phase !== 'playing') problems.push(`Restart left the phase "${after.phase}"`)
  if (after.kills !== 0 || after.score !== 0) problems.push(`Restart kept the run's kills / score (${after.kills} / ${after.score})`)
  if (!(levelTime !== null && levelTime < levelTimeBefore)) problems.push(`Restart kept the level timer (${levelTimeBefore.toFixed(1)} -> ${levelTime?.toFixed(1)} s in)`)
  if (!(after.ride < rideBefore)) problems.push(`Restart did not put the coaster back at the start (track ${rideBefore.toFixed(4)} -> ${after.ride.toFixed(4)})`)
  return {
    id: 'pause-menu',
    problems,
    pauseMenu: { level: levelId, card: card.rect, focusOnOpen: card.focused, afterArrow, restart: { ride: [rideBefore, after.ride], levelTime: [levelTimeBefore, levelTime] } },
  }
}

/** Track fractions the speed check tries for its banked fast section. */
const SPEED_SCAN = [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95]

/** Hold top speed at `fraction` for ≥ 1.5 s so the rig and streaks ease in; returns the camera weight. */
async function rideFast(page, fraction) {
  await page.evaluate((f) => { window.__SC_TEST__.rideTo = f }, fraction)
  const start = Date.now()
  const f0 = await getFrames(page)
  let w
  while (Date.now() - start < 20000) {
    await page.evaluate(() => { window.__SC_TEST__.rideSpeed = 1 })
    await page.waitForTimeout(250)
    const now = await page.evaluate(() => ({ frames: window.__SC_TEST__.frames, w: window.__SC_TEST__.cameraWeight }))
    w = now.w
    if (now.frames - f0 >= 3 && Date.now() - start >= 1500) break
  }
  return { ...w }
}

/** Sense of speed (#27) at the default Screen-shake setting: streaks and bank at top speed, within the caps (speed.png). */
async function speedCheck(page, levelId) {
  await page.evaluate(([lid, seed]) => window.__SC_TEST__.startLevel(lid, seed), [levelId, SEED])
  await waitFrames(page, 2, { minMs: 1000, maxMs: 30000 })
  let best = { fraction: SPEED_SCAN[0], roll: -1 }
  for (const fraction of SPEED_SCAN) {
    const w = await rideFast(page, fraction)
    if (Math.abs(w.roll) > best.roll) best = { fraction, roll: Math.abs(w.roll) }
  }
  const w = await rideFast(page, best.fraction)
  await page.screenshot({ path: path.join(OUT, 'speed.png'), timeout: SHOT_TIMEOUT })
  const problems = []
  if (!(w.streaks > 0.05)) problems.push(`no wind streaks at top speed (opacity ${w.streaks?.toFixed(3)}, speed ${w.speed?.toFixed(2)})`)
  if (!(Math.abs(w.roll) >= 1)) problems.push(`camera barely banks at top speed (${w.roll.toFixed(2)}° at track ${best.fraction})`)
  if (w.maxRoll > CAMERA_WEIGHT_CAPS.roll + 1e-6) problems.push(`camera bank ${w.maxRoll.toFixed(2)}° > ${CAMERA_WEIGHT_CAPS.roll}°`)
  if (w.maxFovKick > CAMERA_WEIGHT_CAPS.fovKick + 1e-6) problems.push(`FOV kick ${w.maxFovKick.toFixed(2)}° > ${CAMERA_WEIGHT_CAPS.fovKick}°`)
  const translation = await page.evaluate(() => window.__SC_TEST__.cameraTranslation.max)
  if (translation > 1e-6) problems.push(`camera translated ${translation.toFixed(3)} units off the track pose`)
  return { id: 'speed', problems, speed: { level: levelId, fraction: best.fraction, ...w } }
}

/** The wave the spawn-choreography check watches arrive: level2's first crow wave, a V (#30). */
const WAVE_CHECK = { level: 'level2', type: 'crow', label: 'A Murder of Crows!', minOnScreen: 5 }

const WAVE_PAUSE_MS = 2000

/**
 * Spawn choreography (#30): the crow wave's tell must lead it, then its V flies in, frozen for `level2-wave.png`.
 * The run is paused and resumed between the tell and the wave: the wave must still come, and no tell or wave twice (#198).
 */
async function waveCheck(page) {
  const { level, type, label, minOnScreen } = WAVE_CHECK
  const problems = []
  await page.evaluate(([lid, seed]) => window.__SC_TEST__.startLevel(lid, seed), [level, SEED])
  const event = (kind) => page
    .waitForFunction(([k, l]) => window.__SC_TEST__.waveEvents.find((e) => e.kind === k && e.label === l) ?? null, [kind, label], { timeout: 90000, polling: 200 })
    .then((h) => h.jsonValue(), () => null)
  const tell = await event('incoming')
  const tellShown = tell
    ? await page.evaluate(() => ({ pulse: !!document.querySelector('.wave-tell'), text: document.querySelector('.wave-banner-text')?.textContent ?? null }))
    : null
  await page.evaluate(() => window.__SC_TEST__.setPhase('paused'))
  await page.waitForTimeout(WAVE_PAUSE_MS)
  await page.evaluate(() => window.__SC_TEST__.setPhase('playing'))
  const arrival = await event('announce')
  // The entry takes 1.2–1.8 s of game time.
  await waitFrames(page, 3, { minMs: 2500, maxMs: 30000 })
  await page.evaluate(() => window.__SC_TEST__.setTimeScale(0))
  await waitFrames(page, 2, { maxMs: 20000, pollMs: 100 })
  const flock = await page.evaluate((t) => window.__SC_TEST__.enemies().filter((e) => e.type === t), type)
  await page.screenshot({ path: path.join(OUT, `${level}-wave.png`), timeout: SHOT_TIMEOUT })
  await page.evaluate(() => window.__SC_TEST__.setTimeScale(1))

  if (!tell) problems.push(`no wave:incoming tell for "${label}"`)
  else if (!tellShown?.pulse) problems.push('the tell showed no screen-edge pulse (.wave-tell)')
  if (tell && tellShown?.text !== label) problems.push(`the tell showed "${tellShown?.text}", not "${label}"`)
  if (!arrival) problems.push(`the "${label}" wave never arrived`)
  const leadS = tell && arrival ? (arrival.ms - tell.ms) / 1000 : null
  if (leadS !== null && leadS < 0.3) problems.push(`the tell came only ${leadS.toFixed(2)} s before the wave`)
  const events = await page.evaluate(() => window.__SC_TEST__.waveEvents.map((e) => `${e.kind} "${e.label}"`))
  const repeated = [...new Set(events.filter((e, i) => events.indexOf(e) !== i))]
  if (repeated.length) problems.push(`wave events fired twice after a pause and Resume: ${repeated.join(', ')}`)
  if (flock.length < minOnScreen) problems.push(`only ${flock.length} ${type}s on screen after the wave flew in (want ≥ ${minOnScreen})`)
  const nearest = flock.reduce((m, e) => Math.min(m, e.distance), Infinity)
  if (nearest < 40) problems.push(`a ${type} is ${nearest.toFixed(0)} units from the camera (near field 40)`)
  return {
    id: 'wave',
    problems,
    wave: { level, onScreen: flock.length, largestPx: Math.round(flock[0]?.px ?? 0), nearest: Math.round(nearest), tellLeadS: leadS },
  }
}

/**
 * The finales the boss check summons: Theme Park's Golden Blimp (#181) and Ocean's Kraken (#183).
 * `minOnScreen` first-phase weak points must be on screen after the boss alone has moved `settleS` s (the
 * Kraken's tentacles rise out of the water first); `midSettleS` lets the last phase surface before `midShot`.
 */
const BOSS_CHECKS = [
  { level: 'level1', minWidthFrac: 0.15, weakPoints: 6, firstPhase: 'balloon-', lastPhase: ['gondola'], midShot: 'boss-gondola', minOnScreen: 1, settleS: 0, midSettleS: 0 },
  { level: 'level3', minWidthFrac: 0.15, weakPoints: 6, firstPhase: 'pad-', lastPhase: ['eye'], midShot: 'boss-head', minOnScreen: 3, settleS: 3, midSettleS: 3 },
]

/** Moves the boss alone `seconds` (`bossStep`, game time and the level timer frozen) until `ready()`. */
async function stepBoss(page, seconds, ready) {
  if (seconds <= 0) return true
  const step = 0.25
  const f0 = await getFrames(page)
  await page.evaluate((s) => { window.__SC_TEST__.bossStep = s }, step)
  const ok = await pollUntil(
    page,
    async () => (await getFrames(page)) - f0 >= seconds / step && (await ready()),
    { ms: 30000 + seconds * 8000, frames: Math.ceil(seconds / step) * 3, pollMs: 200 },
  )
  await page.evaluate(() => { window.__SC_TEST__.bossStep = null })
  await waitFrames(page, 1, { maxMs: 20000, pollMs: 100 })
  return ok
}

/**
 * Boss, summoned: large with its bar (<level>-boss.png), hit in phase order by a real bullet and
 * `bossHit` (<level>-<midShot>.png), then defeated into its burst + the big popup (<level>-boss-down.png).
 * Game time is frozen while it is hit; if the wall-clock level timer still runs out, the step is skipped.
 */
async function bossCheck(page, check) {
  const { level, minWidthFrac, weakPoints, firstPhase, lastPhase, midShot, minOnScreen, settleS, midSettleS } = check
  const problems = []
  const boss = () => page.evaluate(() => window.__SC_TEST__.boss())
  const events = () => page.evaluate(() => ({ ...window.__SC_TEST__.bossEvents }))
  const playing = async () => (await page.evaluate(() => window.__SC_TEST__.phase())) === 'playing'
  await page.evaluate(([lid, seed]) => window.__SC_TEST__.startLevel(lid, seed), [level, SEED])
  await waitFrames(page, 2, { minMs: 1000, maxMs: 30000 })
  const startStats = await getStats(page)
  await page.evaluate(() => window.__SC_TEST__.summonBoss())
  const spawned = await pollUntil(page, async () => (await events()).spawn > 0, { ms: 20000 })
  // A couple of frames so it is placed and drawn, then freeze it there.
  await waitFrames(page, 2, { maxMs: 20000, pollMs: 100 })
  await page.evaluate(() => window.__SC_TEST__.setTimeScale(0))
  await waitFrames(page, 2, { maxMs: 20000, pollMs: 100 })
  const onScreen = async (min) => (await boss()).exposed.filter((e) => e.onScreen).length >= min
  const settled = await stepBoss(page, settleS, () => onScreen(minOnScreen))
  const tell = await page.evaluate(() => window.__SC_TEST__.waveEvents.filter((e) => e.kind === 'incoming').map((e) => e.label))
  const before = await boss()
  const drawCalls = await page.evaluate(() => window.__SC_TEST__.drawCalls)
  const bar = await waitVisible(page, '.hud-boss', 10000)
  const hud = await hudLayoutProblems(page, 'desktop 1280x720 with the boss bar', [...HUD_SELECTORS, '.hud-boss'])
  await page.screenshot({ path: path.join(OUT, `${level}-boss.png`), timeout: SHOT_TIMEOUT })

  // One real bullet at an exposed weak point: time frozen, bullets stepping 0.25 s a frame.
  const target = before.exposed.find((e) => e.onScreen)
  let bulletHit = false
  if (target) {
    await page.waitForTimeout(100) // past the pool's fire delay
    await page.evaluate(({ x, y }) => {
      window.__SC_TEST__.bulletStep = 0.25
      window.__SC_TEST__.fireShot(x, y)
    }, { x: target.ndcX, y: target.ndcY })
    bulletHit = await pollUntil(page, async () => (await events()).hit > 0, { ms: 8000, frames: 8, pollMs: 200 })
    await page.evaluate(() => { window.__SC_TEST__.bulletStep = null })
  }

  // Clear the first phase through processHit: what is left of its hp.
  const firstHp = (await boss()).exposed.reduce((sum, e) => sum + e.hp, 0)
  const phaseOneHits = await page.evaluate((n) => window.__SC_TEST__.bossHit(n), firstHp)
  const midway = await boss()
  await waitFrames(page, 2, { maxMs: 20000, pollMs: 100 })
  const surfaced = await stepBoss(page, midSettleS, () => onScreen(1))
  await page.screenshot({ path: path.join(OUT, `${level}-${midShot}.png`), timeout: SHOT_TIMEOUT })
  const lastHits = await page.evaluate((n) => window.__SC_TEST__.bossHit(n), midway.exposed.reduce((sum, e) => sum + e.hp, 0))
  const finalHits = await boss()
  // Let the last pop finish (slowly, so the confetti stays near) with its popup held.
  await page.evaluate(() => {
    window.__SC_TEST__.holdFeedback = true
    window.__SC_TEST__.setTimeScale(0.25)
  })
  const defeated = await pollUntil(page, async () => (await events()).defeated > 0, { ms: 15000, pollMs: 100 })
  await waitFrames(page, 2, { minMs: 600, maxMs: 20000, pollMs: 100 })
  await page.evaluate(() => window.__SC_TEST__.setTimeScale(0))
  await waitFrames(page, 1, { maxMs: 20000, pollMs: 100 })
  await page.screenshot({ path: path.join(OUT, `${level}-boss-down.png`), timeout: SHOT_TIMEOUT })
  const popup = await page.evaluate(() => [...document.querySelectorAll('.score-popup--big')].map((e) => e.textContent))
  const end = await getStats(page)
  const after = await boss()
  const stillPlaying = await playing()
  await page.evaluate(() => {
    window.__SC_TEST__.holdFeedback = false
    window.__SC_TEST__.setTimeScale(1)
  })

  const result = {
    level, spawned, settled, surfaced, onScreenAtStart: before.exposed.filter((e) => e.onScreen).length, tell, bar, drawCalls, widthFrac: before.box?.widthFrac ?? 0, exposedAtStart: before.exposed.map((e) => e.id),
    bulletHit, phaseOneHits, exposedMidway: midway.exposed.map((e) => e.id), lastHits, hpMidway: midway.hpFraction,
    stage: after.stage, kills: end.kills - startStats.kills, score: end.score - startStats.score, popup, skipped: false,
  }
  if (!stillPlaying && !defeated) {
    result.skipped = true
    return { id: 'boss', problems, boss: result }
  }
  problems.push(...hud.problems)
  if (!spawned) problems.push('summonBoss() never brought the boss in (no boss:spawn)')
  if (!tell.length) problems.push('no tell (wave:incoming) before the boss')
  if (!bar) problems.push('the boss bar (.hud-boss) never showed')
  if (!(result.widthFrac >= minWidthFrac)) problems.push(`the boss is ${(result.widthFrac * 100).toFixed(0)}% of the frame wide (want ≥ ${minWidthFrac * 100}%)`)
  if (!settled || result.onScreenAtStart < minOnScreen)
    problems.push(`${result.onScreenAtStart} first-phase weak points on screen after ${settleS} s (want ≥ ${minOnScreen})`)
  if (!surfaced) problems.push(`the last phase [${lastPhase}] never came on screen within ${midSettleS} s`)
  if (!result.exposedAtStart.length || result.exposedAtStart.some((id) => !id.startsWith(firstPhase)))
    problems.push(`at arrival the exposed weak points are [${result.exposedAtStart}] (want only ${firstPhase}*)`)
  if (!target) problems.push('no exposed weak point on screen to shoot')
  else if (!bulletHit) problems.push('a real bullet at an exposed weak point never hit it (boss:hit)')
  if (JSON.stringify(result.exposedMidway) !== JSON.stringify(lastPhase))
    problems.push(`after the first phase the exposed weak points are [${result.exposedMidway}] (want [${lastPhase}])`)
  if (!(midway.hpFraction < before.hpFraction)) problems.push(`hp did not drop (${before.hpFraction} -> ${midway.hpFraction})`)
  if (finalHits.hpFraction !== 0) problems.push(`hp ${finalHits.hpFraction} after hitting the last phase`)
  if (!defeated) problems.push('boss:defeated never fired')
  if (result.kills !== weakPoints) problems.push(`${result.kills} kills from the boss (want one per weak point, ${weakPoints})`)
  if (!popup.length) problems.push('no big score popup for the defeat')
  return { id: 'boss', problems, boss: result }
}

const PICKUP_CHECK = { level: 'level1', min: 2, max: 4, weapon: 'spread', bullets: 3, pauseMs: 3000 }
/** Track-parameter leads behind the first pickup to park the coaster at. */
const PICKUP_LEADS = [0.006, 0.01, 0.015, 0.004, 0.02, 0.03]

/** Weapon pickups (#185): shoot the first, then the spread fan, badge, pause-safe expiry and restart (level1-pickup.png). */
async function pickupCheck(page) {
  const { level, min, max, weapon, bullets, pauseMs } = PICKUP_CHECK
  const problems = []
  const api = (fn, arg) => page.evaluate(fn, arg)
  const weaponState = () => api(() => window.__SC_TEST__.weaponState())
  await api(([lid, seed]) => window.__SC_TEST__.startLevel(lid, seed), [level, SEED])
  await waitFrames(page, 2, { minMs: 1000, maxMs: 30000 })
  await api(() => window.__SC_TEST__.setTimeScale(0))

  let pickups = await api(() => window.__SC_TEST__.pickups())
  const result = { count: pickups.length, ids: pickups.map((p) => p.id), lead: null, px: null }
  if (pickups.length < min || pickups.length > max) problems.push(`${pickups.length} pickups (want ${min}–${max})`)
  const first = pickups[0]
  let target = null
  if (first) {
    for (const lead of PICKUP_LEADS) {
      await api((t) => { window.__SC_TEST__.rideTo = t }, first.t - lead)
      await waitFrames(page, 2, { maxMs: 20000, pollMs: 100 })
      pickups = await api(() => window.__SC_TEST__.pickups())
      const p = pickups[0]
      if (p.onScreen && Math.abs(p.ndcX) < 0.8 && Math.abs(p.ndcY) < 0.8) {
        target = p
        result.lead = lead
        break
      }
    }
  }
  const drawCalls = await api(() => window.__SC_TEST__.drawCalls)
  if (!target) problems.push(`the first pickup never came on screen from ${PICKUP_LEADS.length} spots behind it`)
  else {
    result.px = { x: Math.round(target.x), y: Math.round(target.y), distance: Math.round(target.distance) }
    await api(({ x, y }) => {
      window.__SC_TEST__.bulletStep = 0.25
      window.__SC_TEST__.fireShot(x, y)
    }, { x: target.ndcX, y: target.ndcY })
    const got = await pollUntil(page, async () => (await weaponState()).pickup === weapon, { ms: 8000, frames: 8, pollMs: 200 })
    if (!got) problems.push(`shooting the ${target.id} pickup did not arm it (${JSON.stringify(await weaponState())})`)
    await api(() => window.__SC_TEST__.setTimeScale(1))
    const gone = await pollUntil(page, async () => (await api(() => window.__SC_TEST__.pickups()))[0].gone, { ms: 10000, frames: 1, pollMs: 100 })
    await api(() => window.__SC_TEST__.setTimeScale(0))
    if (!gone) problems.push('the shot pickup never popped')
  }

  const before = await getStats(page)
  await page.waitForTimeout(100) // past the fire interval
  await api(() => {
    window.__SC_TEST__.bulletStep = 0
    window.__SC_TEST__.holdFeedback = true
    window.__SC_TEST__.fireShot(0.1, 0.35)
  })
  await waitFrames(page, 2, { maxMs: 20000, pollMs: 100 })
  const after = await getStats(page)
  const drawn = (await api(() => window.__SC_TEST__.bullets())).drawn
  result.fan = { shots: after.shotsFired - before.shotsFired, drawn }
  if (result.fan.shots !== bullets) problems.push(`a spread pull counted ${result.fan.shots} shots (want ${bullets})`)
  if (drawn < bullets) problems.push(`a spread pull drew ${drawn} bullets (want ${bullets})`)
  const badge = await waitVisible(page, '.hud-weapon', 10000)
  if (!badge) problems.push('no weapon badge with a pickup active')
  const hud = await hudLayoutProblems(page, 'desktop 1280x720 with the weapon badge', [...HUD_SELECTORS, '.hud-weapon'])
  problems.push(...hud.problems)
  const label = await api(() => document.querySelector('.hud-weapon-label')?.textContent ?? null)
  if (label?.toLowerCase() !== weapon) problems.push(`badge reads "${label}" (want ${weapon})`)
  await page.screenshot({ path: path.join(OUT, `${level}-pickup.png`), timeout: SHOT_TIMEOUT })
  await api(() => {
    window.__SC_TEST__.holdFeedback = false
    window.__SC_TEST__.bulletStep = null
  })

  const held = await weaponState()
  await api(() => {
    window.__SC_TEST__.setTimeScale(1)
    window.__SC_TEST__.setPhase('paused')
  })
  await page.waitForTimeout(pauseMs)
  const paused = await weaponState()
  if (Math.abs(paused.remaining - held.remaining) > 1e-6)
    problems.push(`the pickup ran down while paused (${held.remaining.toFixed(3)} -> ${paused.remaining.toFixed(3)})`)
  await api(() => {
    window.__SC_TEST__.setPhase('playing')
    window.__SC_TEST__.setTimeScale(4)
  })
  const expired = await pollUntil(page, async () => (await weaponState()).active === 'blaster', { ms: 60000, frames: 2, pollMs: 500 })
  if (!expired) problems.push(`the pickup never expired (${JSON.stringify(await weaponState())})`)
  else if (!(await pollUntil(page, () => api(() => !document.querySelector('.hud-weapon.is-visible')), { ms: 5000, frames: 1, pollMs: 250 })))
    problems.push('the weapon badge stayed up after the pickup expired')

  await api(([lid, seed]) => window.__SC_TEST__.startLevel(lid, seed), [level, SEED])
  await waitFrames(page, 2, { maxMs: 20000, pollMs: 100 })
  const restarted = { weapon: await weaponState(), collected: (await api(() => window.__SC_TEST__.pickups())).filter((p) => p.collected).length }
  if (restarted.weapon.pickup !== null) problems.push(`startRun kept the pickup (${restarted.weapon.pickup})`)
  if (restarted.collected) problems.push(`${restarted.collected} pickup(s) still collected after a restart`)
  return { id: 'pickup', problems, pickup: { ...result, drawCalls, badge: hud.rects.at(-1) } }
}

/**
 * A real start (`?e2e=1&countdown=1` keeps the hook but not the countdown skip): Ready / Set / GO
 * shows over the mounted level, a press during it fires nothing (not even when held on into
 * play), the timer holds and the shader warm-up finishes. A replay's countdown then checks
 * that a tap after the 1 s mark skips to GO / playing.
 */
/** Level select with saved progress (3★, 1★): cards, locks, star total, 1280x720 fit, keyboard-only start. */
async function levelSelectCheck(page, levels) {
  const problems = []
  const scores = {}
  const earned = [3, 1]
  levels.slice(0, 2).forEach((l, i) => {
    scores[l.id] = { level: l.id, score: 1000 * (2 - i), maxScore: 0, stars: earned[i], timestamp: 0 }
  })
  const expectStars = earned.slice(0, levels.length).reduce((a, b) => a + b, 0)
  const expectOpen = Math.min(levels.length, 3)
  await page.evaluate((s) => {
    window.__SC_TEST__.setSavedScores(s)
    window.__SC_TEST__.setPhase('levelSelect')
  }, scores)
  if (!(await waitVisible(page, '.level-select-back'))) problems.push('level select never appeared')
  await page.waitForTimeout(800) // fade-in
  await waitFrames(page, 2, { maxMs: 10000 })
  await page.screenshot({ path: path.join(OUT, 'levelSelect.png'), timeout: SHOT_TIMEOUT })

  const layout = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.level-card')]
    const root = document.querySelector('.level-select')
    const off = cards.filter((c) => {
      const r = c.getBoundingClientRect()
      return r.left < 0 || r.top < 0 || r.right > window.innerWidth || r.bottom > window.innerHeight
    })
    return {
      cards: cards.length,
      locked: cards.filter((c) => c.dataset.locked === 'true').length,
      total: document.querySelector('.level-select-total')?.dataset.stars ?? null,
      totalText: document.querySelector('.level-select-total')?.textContent ?? '',
      offscreen: off.map((c) => c.dataset.level),
      hScroll: root ? root.scrollWidth > root.clientWidth : true,
      focused: document.activeElement?.dataset?.level ?? null,
    }
  })
  // One card per level plus the Daily Run card (#184).
  if (layout.cards !== levels.length + 1) problems.push(`${layout.cards} cards for ${levels.length} levels + Daily`)
  if (layout.locked !== levels.length - expectOpen) problems.push(`${layout.locked} locked cards, expected ${levels.length - expectOpen}`)
  if (Number(layout.total) !== expectStars || !layout.totalText.includes(`${expectStars} / ${levels.length * 3}`)) {
    problems.push(`star total "${layout.totalText.trim()}", expected ${expectStars} / ${levels.length * 3}`)
  }
  if (layout.offscreen.length) problems.push(`cards off a 1280x720 screen: ${layout.offscreen.join(',')}`)
  if (layout.hScroll) problems.push('level select scrolls sideways')

  const focused = () => page.evaluate(() => document.activeElement?.dataset?.level ?? null)
  const target = levels[Math.min(2, levels.length - 1)].id
  if (layout.focused !== target) problems.push(`initial focus on ${layout.focused}, expected ${target}`)
  let keyboard = null
  if (levels.length >= 4) {
    await page.keyboard.press('ArrowLeft')
    const left = await focused()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    const locked = await focused()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(700)
    const phaseAfterLocked = await page.evaluate(() => window.__SC_TEST__.phase())
    await page.keyboard.press('ArrowLeft')
    await page.evaluate(() => {
      window.__sawLaunch = false
      const root = document.querySelector('.level-select')
      new MutationObserver(() => {
        if (root?.classList.contains('is-launching')) window.__sawLaunch = true
      }).observe(root, { attributes: true, attributeFilter: ['class'] })
    })
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => window.__SC_TEST__.phase() === 'playing', null, { timeout: 15000 }).catch(() => {})
    const after = await page.evaluate(() => ({ phase: window.__SC_TEST__.phase(), level: window.__SC_TEST__.stats().currentLevel, sawLaunch: window.__sawLaunch }))
    keyboard = { left, locked, phaseAfterLocked, ...after }
    if (left !== levels[1].id) problems.push(`ArrowLeft focused ${left}, expected ${levels[1].id}`)
    if (locked !== levels[3].id) problems.push(`ArrowRight x2 focused ${locked}, expected ${levels[3].id}`)
    if (phaseAfterLocked !== 'levelSelect') problems.push(`Enter on a locked card left level select (${phaseAfterLocked})`)
    if (!after.sawLaunch) problems.push('no launch transition before the run started')
    if (after.phase !== 'playing' || after.level !== target) problems.push(`Enter started ${after.level} (${after.phase}), expected ${target}`)
  }
  return { id: 'levelSelect', ok: problems.length === 0, problems, levelSelect: { ...layout, keyboard } }
}

/** Click the level select's Daily card (#184) and return the run it started and its spawnDigest(). */
async function startDailyFromCard(page, savedScores) {
  await page.evaluate((s) => {
    window.__SC_TEST__.setSavedScores(s)
    window.__SC_TEST__.setPhase('levelSelect')
  }, savedScores)
  if (!(await waitVisible(page, '.level-card-daily'))) return { run: null, digest: null }
  await page.locator('.level-card-daily').click({ timeout: 30000 })
  await page.waitForFunction(() => window.__SC_TEST__.phase() === 'playing', null, { timeout: 30000 }).catch(() => {})
  const run = await page.evaluate(() => {
    const s = window.__SC_TEST__
    return { ...s.daily(), phase: s.phase(), runSeed: s.stats().runSeed, currentLevel: s.stats().currentLevel }
  })
  return { run, digest: await nextSpawnDigest(page, null) }
}

/**
 * Daily Run (#184): the card starts today's level on today's seed in daily mode, two loads spawn the same,
 * the results say DAILY / NEW BEST with no Next Level, Replay keeps the seed, and campaign saves stay as they were.
 */
async function dailyCheck(newPage) {
  const problems = []
  const campaign = { level1: { level: 'level1', score: 1000, maxScore: 0, stars: 3, timestamp: 0 } }
  const first = await newPage()
  const a = await startDailyFromCard(first.page, campaign)
  const { run } = a
  if (!run) problems.push('no Daily card on the level select')
  else {
    if (run.phase !== 'playing') problems.push(`the Daily card left the game in "${run.phase}"`)
    if (run.runMode?.mode !== 'daily' || run.runMode.dateKey !== run.dateKey) problems.push(`run mode ${JSON.stringify(run.runMode)}, expected daily ${run.dateKey}`)
    if (run.runSeed !== run.seed) problems.push(`daily run seed ${run.runSeed}, expected dailySeed(${run.dateKey}) = ${run.seed}`)
    if (run.currentLevel !== run.level) problems.push(`daily started ${run.currentLevel}, expected ${run.level}`)
  }
  if (!a.digest) problems.push('spawnDigest() never reported the daily spawns')

  // Score something so the day's first result is a NEW BEST, then end the run.
  await first.page.evaluate(() => window.__SC_TEST__.killNearest(3))
  await waitFrames(first.page, 2, { maxMs: 20000 })
  await first.page.evaluate(() => window.__SC_TEST__.endLevel())
  const resultsShown = await first.page
    .waitForFunction(() => document.querySelector('.results-screen')?.getAttribute('data-sequence') === 'done', null, { timeout: 60000, polling: 250 })
    .then(() => true, () => false)
  await first.page.waitForTimeout(1500)
  await first.page.screenshot({ path: path.join(OUT, 'daily-results.png'), timeout: SHOT_TIMEOUT })
  const results = await first.page.evaluate(() => {
    const el = document.querySelector('.results-screen')
    const s = window.__SC_TEST__
    return {
      mode: el?.dataset.mode ?? null,
      badge: el?.querySelector('.results-daily-badge')?.textContent ?? null,
      record: el?.querySelector('.results-record')?.textContent ?? null,
      buttons: [...(el?.querySelectorAll('.results-actions button') ?? [])].map((b) => b.textContent),
      score: s.stats().score,
      daily: s.daily(),
      savedScores: JSON.parse(localStorage.getItem('shootercoaster-scores') ?? '{}').state?.savedScores ?? null,
    }
  })
  const savedDay = run ? results.daily.savedDaily[run.dateKey] : undefined
  if (!resultsShown) problems.push('daily results screen never finished its reveal')
  if (results.mode !== 'daily' || !results.badge) problems.push(`daily results lack the Daily badge (mode ${results.mode})`)
  if (results.score > 0 && results.record !== 'NEW BEST') problems.push(`first daily result shows "${results.record}", expected NEW BEST`)
  if (results.buttons.includes('Next Level')) problems.push('daily results offer Next Level')
  if (!savedDay || savedDay.score !== Math.round(results.score)) problems.push(`today's daily best ${JSON.stringify(savedDay)}, expected score ${Math.round(results.score)}`)
  if (results.daily.streak.count !== 1 || results.daily.streak.lastKey !== run?.dateKey) problems.push(`daily streak ${JSON.stringify(results.daily.streak)}, expected 1 day`)
  if (JSON.stringify(results.savedScores) !== JSON.stringify(campaign)) problems.push(`a daily run changed the campaign saves: ${JSON.stringify(results.savedScores)}`)

  // Replay replays the same seed in daily mode.
  await first.page.locator('.results-actions button', { hasText: 'Replay' }).click({ timeout: 10000 }).catch((e) => problems.push(`click Replay: ${e.message}`))
  await first.page.waitForFunction(() => window.__SC_TEST__.phase() === 'playing', null, { timeout: 30000 }).catch(() => {})
  const replay = await first.page.evaluate(() => ({ runSeed: window.__SC_TEST__.stats().runSeed, mode: window.__SC_TEST__.daily().runMode.mode }))
  if (run && (replay.runSeed !== run.seed || replay.mode !== 'daily')) problems.push(`Replay ran seed ${replay.runSeed} (${replay.mode}), expected the daily seed ${run.seed}`)
  const errors = [...first.errors, ...(await first.page.evaluate(() => window.__SC_TEST__.errors))]
  await first.ctx.close()

  // A second load on the same date spawns the same enemies.
  const second = await newPage()
  const b = await startDailyFromCard(second.page, {})
  errors.push(...second.errors, ...(await second.page.evaluate(() => window.__SC_TEST__.errors)))
  await second.ctx.close()
  if (b.run?.runSeed !== run?.seed) problems.push(`second load ran seed ${b.run?.runSeed}, expected ${run?.seed}`)
  if (b.digest !== a.digest) problems.push(`two loads of today's daily spawned differently (${a.digest} vs ${b.digest})`)
  if (errors.length) problems.push(`${errors.length} error(s)`)

  return {
    id: 'daily',
    ok: problems.length === 0,
    problems,
    errors,
    daily: { dateKey: run?.dateKey, level: run?.level, seed: run?.seed, digest: a.digest, digestAgain: b.digest, record: results.record, replaySeed: replay.runSeed },
  }
}

/** The settings card (#35): inside the viewport, no sideways scroll, every control there and ≥ 44 px tall. */
async function settingsLayout(page, label) {
  const r = await page.evaluate(() => {
    const card = document.querySelector('.settings-card')
    const root = document.querySelector('.settings-screen')
    const b = card?.getBoundingClientRect()
    const targets = [...document.querySelectorAll('.settings-card button, .settings-card .settings-row')]
    return {
      rect: b ? { left: Math.round(b.left), top: Math.round(b.top), right: Math.round(b.right), bottom: Math.round(b.bottom) } : null,
      vw: window.innerWidth,
      vh: window.innerHeight,
      hScroll: root ? root.scrollWidth > root.clientWidth : true,
      quality: [...document.querySelectorAll('[aria-labelledby="settings-quality-label"] [role="radio"]')].map((el) => el.textContent),
      sliders: document.querySelectorAll('.settings-card input[type="range"]').length,
      switches: document.querySelectorAll('.settings-card input[role="switch"]').length,
      smallTargets: targets.filter((el) => el.getBoundingClientRect().height < 44).length,
    }
  })
  const problems = []
  if (!r.rect) problems.push('no settings card')
  else if (r.rect.left < 0 || r.rect.top < 0 || r.rect.right > r.vw || r.rect.bottom > r.vh)
    problems.push(`the settings card (${r.rect.left},${r.rect.top})-(${r.rect.right},${r.rect.bottom}) leaves the ${r.vw}x${r.vh} viewport`)
  if (r.hScroll) problems.push('settings scroll sideways')
  if (r.quality.length !== 4) problems.push(`${r.quality.length} quality options (${r.quality.join('/')}), expected Auto / Low / Med / High`)
  if (r.sliders !== 2) problems.push(`${r.sliders} volume sliders, expected music + effects`)
  if (r.switches !== 2) problems.push(`${r.switches} switches, expected show FPS + reduced motion`)
  if (r.smallTargets) problems.push(`${r.smallTargets} settings control(s) under the 44 px touch target`)
  return { ...r, problems: problems.map((p) => `${label}: ${p}`) }
}

/**
 * Settings from the title (settings.png): the card's layout, Esc back to the title, and the quality +
 * music volume picked there still set after a reload.
 */
async function settingsCheck(page) {
  const problems = []
  if (!(await waitVisible(page, '.settings-button'))) return { id: 'settings', problems: ['no settings button on the title'] }
  await page.locator('.settings-button').click({ timeout: 30000 })
  if (!(await waitVisible(page, '.settings-card', 30000))) return { id: 'settings', problems: ['the settings card never showed'] }
  await waitFrames(page, 1, { minMs: 400, maxMs: 8000 })
  const layout = await settingsLayout(page, 'desktop 1280x720')
  problems.push(...layout.problems)
  await page.screenshot({ path: path.join(OUT, 'settings.png'), timeout: SHOT_TIMEOUT })

  const before = await page.evaluate(() => window.__SC_TEST__.graphics().quality)
  if (before !== 'auto') problems.push(`quality "${before}" by default, expected auto`)
  await page.getByRole('radio', { name: 'Low', exact: true }).click({ timeout: 30000 })
  await page.waitForFunction(() => window.__SC_TEST__.graphics().quality === 'low', null, { timeout: 5000 }).catch(() => {})
  const picked = await page.evaluate(() => window.__SC_TEST__.graphics().quality)
  await page.locator('.settings-card input[type="range"]').first().fill('0.3')
  if (picked !== 'low') problems.push(`clicking Low set the quality to "${picked}"`)
  await page.keyboard.press('Escape')
  const closed = await page
    .waitForSelector('.settings-card', { state: 'detached', timeout: 10000 })
    .then(() => true, () => false)
  if (!closed) problems.push('Esc did not close settings')
  if (!(await waitVisible(page, '.title-screen .play-button', 30000))) problems.push('the title did not come back after settings')

  await page.reload({ waitUntil: 'load' })
  await page.waitForFunction(() => !!window.__SC_TEST__, null, { timeout: 30000 })
  const reloaded = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('shootercoaster-settings') ?? '{}').state ?? {}
    return { quality: window.__SC_TEST__.graphics().quality, musicVolume: saved.musicVolume }
  })
  if (reloaded.quality !== 'low') problems.push(`quality "${reloaded.quality}" after a reload, expected low`)
  if (reloaded.musicVolume !== 0.3) problems.push(`music volume ${reloaded.musicVolume} after a reload, expected 0.3`)
  return { id: 'settings', problems, settings: { card: layout.rect, quality: [before, picked, reloaded.quality], musicVolume: reloaded.musicVolume } }
}

/**
 * `?quality=low` (#35) against the default on the same level, seed and frozen track point, both at device
 * dpr 2: dpr 1 instead of 2, no contact shadows, fewer draw calls (no bloom passes). `<id>-low.png`.
 */
async function qualityCheck(newPage, levelId) {
  const sample = async (query, png) => {
    const { ctx, page, errors } = await newPage(query, { deviceScaleFactor: 2 })
    await page.evaluate(([lid, seed]) => window.__SC_TEST__.startLevel(lid, seed), [levelId, SEED])
    await waitFrames(page, 2, { minMs: 1500, maxMs: 30000 })
    await page.evaluate(() => {
      window.__SC_TEST__.setTimeScale(0)
      window.__SC_TEST__.rideTo = 0.1
    })
    await waitFrames(page, 3, { maxMs: 30000 })
    const s = await page.evaluate(() => {
      const t = window.__SC_TEST__
      return { drawCalls: t.drawCalls, dpr: t.view()?.dpr, graphics: t.graphics(), shadows: !!t.sceneStats().byName['contact-shadows'], errors: t.errors }
    })
    if (png) await page.screenshot({ path: path.join(OUT, png), timeout: SHOT_TIMEOUT })
    await ctx.close()
    return { ...s, errors: [...errors, ...s.errors] }
  }
  const high = await sample('e2e=1')
  const low = await sample('e2e=1&quality=low', `${levelId}-low.png`)
  const problems = []
  if (high.graphics.quality !== 'auto' || high.dpr !== 2) problems.push(`default: quality ${high.graphics.quality} at dpr ${high.dpr}, expected auto at 2`)
  if (low.graphics.quality !== 'low') problems.push(`?quality=low set the quality to "${low.graphics.quality}"`)
  if (low.dpr !== 1) problems.push(`low quality renders at dpr ${low.dpr}, expected 1`)
  if (!high.shadows) problems.push('no contact shadows on the default quality')
  if (low.shadows) problems.push('contact shadows still drawn on low quality')
  if (!(low.drawCalls < high.drawCalls)) problems.push(`low quality draws ${low.drawCalls} calls, not fewer than the default's ${high.drawCalls}`)
  return { id: 'quality', problems, errors: [...high.errors, ...low.errors], quality: { level: levelId, drawCalls: [high.drawCalls, low.drawCalls], dpr: [high.dpr, low.dpr] } }
}

/** Fetches of Tone.js's chunk so far (`audio/tone.ts`: loaded on the first gesture, never at startup). */
const toneRequests = (page) =>
  page.evaluate(() => performance.getEntriesByType('resource').filter((e) => /\/tone-[^/]*\.js$/.test(e.name)).length)

/** Title (#28): another camera angle 6 s later (`title-2.png`), the start hint, and a key press fading to level select
 *  that also loads Tone.js (#187: not before it) and unlocks audio. */
async function titleFlyBy(page) {
  const problems = []
  const pose = () => page.evaluate(() => window.__SC_TEST__.cameraPose())
  const a = await pose()
  const at = Date.now()
  await waitFrames(page, 2, { minMs: 6000, maxMs: 30000 })
  const b = await pose()
  const waited = (Date.now() - at) / 1000
  await page.screenshot({ path: path.join(OUT, 'title-2.png'), timeout: SHOT_TIMEOUT })
  let turnedDeg = 0
  let moved = 0
  if (!a || !b) problems.push('no title camera')
  else {
    const dot = a.forward.reduce((sum, v, i) => sum + v * b.forward[i], 0)
    turnedDeg = (Math.acos(Math.min(1, dot)) * 180) / Math.PI
    moved = Math.hypot(...a.position.map((v, i) => v - b.position[i]))
    if (turnedDeg < 8 && moved < 30)
      problems.push(`title camera barely moved in ${waited.toFixed(1)} s (${turnedDeg.toFixed(1)} deg, ${moved.toFixed(0)} units)`)
  }
  const hint = await page.locator('.title-hint').textContent({ timeout: 5000 }).catch(() => null)
  if (!hint) problems.push('no start hint on the first title')

  const toneBefore = { requests: await toneRequests(page), loaded: await page.evaluate(() => window.__SC_TEST__.audio().toneLoaded) }
  if (toneBefore.requests > 0 || toneBefore.loaded) problems.push('Tone.js loaded before the first key press on the title')
  await page.keyboard.press('Enter')
  const veiled = await page
    .waitForSelector('.screen-veil', { state: 'attached', timeout: 10000 })
    .then(() => true, () => false)
  if (!veiled) problems.push('a key press on the title did not fade to black')
  const opened = await page
    .waitForFunction(() => window.__SC_TEST__.phase() === 'levelSelect', null, { timeout: 30000 })
    .then(() => true, () => false)
  if (!opened) problems.push('a key press on the title did not open level select')
  const veilGone = await page
    .waitForSelector('.screen-veil', { state: 'detached', timeout: 30000 })
    .then(() => true, () => false)
  if (!veilGone) problems.push('the fade to black never cleared over level select')
  const toneAfter = await page
    .waitForFunction(() => window.__SC_TEST__.audio().toneLoaded && window.__SC_TEST__.audio().ready, null, { timeout: 30000 })
    .then(() => true, () => false)
  if (!toneAfter) problems.push('the key press on the title did not load Tone.js and unlock audio')
  return { problems, result: { turnedDeg, moved, waited, hint, veiled, opened, toneBefore, toneAfter } }
}

async function countdownCheck(page, levelId) {
  const start = () => page.evaluate(([lid, seed]) => window.__SC_TEST__.startLevel(lid, seed), [levelId, SEED])
  // Attached, not faded in: at ~1 fps, waiting on the fade could outlast the countdown.
  const stepShown = () => page
    .waitForSelector('.countdown-step', { state: 'attached', timeout: 30000 })
    .then(() => true, () => false)
  // Stats read in the page the moment GO lands (the first playing frame doesn't count, the next may).
  const waitPlaying = () => page
    .waitForFunction(() => window.__SC_TEST__.phase() === 'playing' && window.__SC_TEST__.stats(), null, { timeout: 30000, polling: 100 })
    .then((h) => h.jsonValue(), () => null)
  const pointer = { clientX: 640, clientY: 360, pointerId: 1, isPrimary: true, pointerType: 'mouse', bubbles: true }

  // Let the title draw first, so the startup timings cover it.
  await page.waitForFunction(() => window.__SC_TEST__.initTimings().titleFrame !== undefined, null, { timeout: 30000, polling: 100 }).catch(() => {})

  // 1. Press during the countdown and hold it on into play.
  await start()
  const startPhase = await page.evaluate(() => window.__SC_TEST__.phase())
  const shown = await stepShown()
  // One JS turn, so GO can't land between the phase read and the press (shots fire on pointerdown).
  // holdFeedback holds the step through the screenshot.
  const during = await page.evaluate((at) => {
    const api = window.__SC_TEST__
    if (api.phase() !== 'countdown') return null
    document.querySelector('canvas').dispatchEvent(new PointerEvent('pointerdown', at))
    api.holdFeedback = true
    return api.stats()
  }, pointer)
  let stepText = null
  if (during) {
    // Settled: the held step has finished its scale-in (an exiting step is still mid-transform).
    await page
      .waitForFunction(() => {
        const el = document.querySelector('.countdown-step')
        return el && getComputedStyle(el).opacity === '1' && getComputedStyle(el).transform === 'none'
      }, null, { timeout: 30000, polling: 100 })
      .catch(() => {})
    stepText = await page.locator('.countdown-step').first().textContent().catch(() => null)
    await page.screenshot({ path: path.join(OUT, 'countdown.png'), timeout: SHOT_TIMEOUT })
  }
  // Read before letting the countdown run on: by now the level is mounted and its timer reset, held at full.
  const held = await page.evaluate(() => {
    const api = window.__SC_TEST__
    api.holdFeedback = false
    return api.stats()
  })
  const goStats = await waitPlaying()
  const atGo = goStats ?? (await getStats(page))
  // Still holding in play: the trigger is down, but a press from the countdown never auto-fires.
  await waitFrames(page, 3, { minMs: 2000, maxMs: 30000 })
  const heldInPlay = await page.evaluate((at) => {
    const api = window.__SC_TEST__
    const r = { held: api.triggerHeld(), stats: api.stats() }
    document.querySelector('canvas').dispatchEvent(new PointerEvent('pointerup', at))
    return r
  }, pointer)
  const warmup = await page
    .waitForFunction(() => window.__SC_TEST__.shaderWarmup?.done && window.__SC_TEST__.shaderWarmup, null, { timeout: 60000, polling: 250 })
    .then((h) => h.jsonValue(), () => page.evaluate(() => window.__SC_TEST__.shaderWarmup))
  // First shot + kill after the warm-up: a new shader program here is the first-shot hitch (#28).
  const shotStart = await page.evaluate((at) => {
    const api = window.__SC_TEST__
    const r = { programs: api.programs(), avgFrameMs: api.avgFrameMs }
    api.maxFrameMs = 0
    const canvas = document.querySelector('canvas')
    canvas.dispatchEvent(new PointerEvent('pointerdown', at))
    canvas.dispatchEvent(new PointerEvent('pointerup', at))
    api.killNearest(1)
    return r
  }, pointer)
  await waitFrames(page, 4, { minMs: 1500, maxMs: 30000 })
  const firstShot = await page.evaluate((before) => {
    const api = window.__SC_TEST__
    return { ...before, programsAfter: api.programs(), maxFrameMs: api.maxFrameMs, shots: api.stats().shotsFired }
  }, shotStart)

  // 2. Replay through results (as the UI does) and tap after the 1 s mark: it skips to GO.
  await page.evaluate(() => window.__SC_TEST__.endLevel())
  await start()
  const shownAgain = await stepShown()
  await page.waitForTimeout(1200)
  const tappedIn = await page.evaluate((at) => {
    const phase = window.__SC_TEST__.phase()
    const canvas = document.querySelector('canvas')
    canvas.dispatchEvent(new PointerEvent('pointerdown', at))
    canvas.dispatchEvent(new PointerEvent('pointerup', at))
    return phase
  }, pointer)
  const afterTap = await waitPlaying()
  const initTimings = await page.evaluate(() => window.__SC_TEST__.initTimings())

  const problems = []
  if (startPhase !== 'countdown') problems.push(`startLevel entered "${startPhase}", not countdown`)
  if (!shown) problems.push('no Ready / Set / GO on screen')
  if (!during) problems.push('countdown over before the press check')
  else if (during.shotsFired > 0) problems.push(`a press during the countdown fired ${during.shotsFired} shot(s)`)
  if (!goStats) problems.push(`phase never reached playing (still "${atGo.phase}")`)
  if (held.phase === 'countdown' && atGo.timeRemaining < held.timeRemaining - 3)
    problems.push(`timer ran during the countdown (${held.timeRemaining.toFixed(1)} -> ${atGo.timeRemaining.toFixed(1)} at GO)`)
  if (!heldInPlay.held) problems.push('the countdown press was no longer held after GO')
  if (heldInPlay.stats.shotsFired > 0)
    problems.push(`the trigger held through the countdown fired ${heldInPlay.stats.shotsFired} shot(s) after GO`)
  if (!warmup?.done) problems.push('shader warm-up never finished')
  if (firstShot.shots === 0) problems.push('the first-shot check fired nothing')
  if (firstShot.programsAfter > firstShot.programs)
    problems.push(`the first shot + kill compiled ${firstShot.programsAfter - firstShot.programs} shader program(s) after the warm-up`)
  if (!shownAgain) problems.push('no countdown on replay')
  if (!afterTap) problems.push(`the replay never reached playing after a tap in "${tappedIn}"`)
  else if (afterTap.shotsFired > 0) problems.push(`the skip tap fired ${afterTap.shotsFired} shot(s)`)
  return {
    id: 'countdown',
    ok: problems.length === 0,
    problems,
    initTimings,
    countdown: {
      level: levelId,
      stepText,
      timerDuring: held.timeRemaining,
      timerAtGo: atGo.timeRemaining,
      shotsHeldIntoPlay: heldInPlay.stats.shotsFired,
      skipTapIn: tappedIn,
      warmup,
      firstShot,
    },
  }
}

/** Title -> level music (#28) crossfades: read from the ramp log, since at ~1 fps a 1 s fade fits between two polls. */
async function musicCrossfade(page) {
  const problems = []
  const read = () => page.evaluate(() => window.__SC_TEST__.audio())
  const first = await read()
  if (!first.ready) return { problems: ['PLAY tap did not unlock audio'], result: null }
  const deadline = Date.now() + 30000
  let now = first
  while (Date.now() < deadline) {
    const names = now.music.buses.map((b) => b.name)
    if (names.includes('level') && !names.includes('title')) break
    await page.waitForTimeout(250)
    now = await read()
  }
  const { fades, buses } = now.music
  const titleOut = fades.findLast((f) => f.name === 'title' && f.ramp === 'out')
  const levelIn = fades.findLast((f) => f.name === 'level' && f.ramp === 'in')
  if (!titleOut) problems.push('the title music never faded out when the level started')
  else if (titleOut.from < 0.5 || titleOut.seconds < 0.5)
    problems.push(`title music fade-out was not a ramp from full (from ${titleOut.from.toFixed(2)} over ${titleOut.seconds} s)`)
  if (!levelIn || levelIn.seconds < 0.5) problems.push('the level music did not fade in')
  if (buses.some((b) => b.name === 'title')) problems.push('the title music bus was never disposed')
  if (!buses.some((b) => b.name === 'level' && !b.fading)) problems.push('no level music playing')
  return { problems, result: { fades, buses } }
}

const SCRIM_CHECK = { level: 'level1', maxNodes: 150, burst: [64, 32] }

/**
 * `?audio=scrim` (#214): a real click unlocks audio and starts the title score; level1 must crossfade from it, keep its
 * long-lived node count flat (≤ maxNodes) while it plays, duck with game time frozen, hold its song position while
 * paused and pick it up again, then crossfade to the results score; nothing dropped, no page errors.
 * The arcade SFX (#217): `audioBurst(64, 32)` must stay inside the voice budget (stealing, not growing), keep the SFX
 * node count flat across it, and throw or drop nothing.
 */
async function scrimCheck(page) {
  const problems = []
  const audio = () => page.evaluate(() => window.__SC_TEST__.audio())
  /** Polls `audio()` until `check` holds; returns the last reading. */
  const until = async (check, ms = 30000) => {
    const deadline = Date.now() + ms
    let a = await audio()
    while (!check(a) && Date.now() < deadline) {
      await page.waitForTimeout(250)
      a = await audio()
    }
    return a
  }
  const busNames = (a) => a.music.buses.map((b) => b.name)
  const track = (a) => a.scrim?.tracks.at(-1) ?? null
  const result = { engine: null, title: false, nodes: [], position: [], sfxNodes: [], voices: null, pausedHeld: null, ducked: null, results: false, dropped: 0 }

  const vp = page.viewportSize()
  await page.mouse.click(8, vp.height - 8) // any pointer press on the title unlocks audio
  let a = await until((x) => x.scrim?.current === 'title')
  result.engine = a.engine
  if (a.engine !== 'scrim') return { problems: [`?audio=scrim reports engine "${a.engine}"`], result }
  if (!a.ready) return { problems: ['a click did not unlock audio'], result }
  result.title = a.scrim?.current === 'title'
  if (!result.title) problems.push('the title score never started')

  await page.evaluate(([lid, seed]) => window.__SC_TEST__.startLevel(lid, seed), [SCRIM_CHECK.level, SEED])
  a = await until((x) => x.scrim?.current === SCRIM_CHECK.level && !busNames(x).includes('title'))
  const titleOut = a.music.fades.findLast((f) => f.name === 'title' && f.ramp === 'out')
  const levelIn = a.music.fades.findLast((f) => f.name === 'level' && f.ramp === 'in')
  if (a.scrim?.current !== SCRIM_CHECK.level) problems.push(`the ${SCRIM_CHECK.level} score never started (current "${a.scrim?.current}")`)
  if (!titleOut || titleOut.seconds < 0.5) problems.push('the title score did not fade out')
  if (!levelIn || levelIn.seconds < 0.5) problems.push('the level score did not fade in')
  if (busNames(a).includes('title')) problems.push('the title score bus was never disposed')

  result.nodes.push(a.scrim.nodes)
  result.position.push(track(a)?.position ?? 0)
  await waitFrames(page, 2, { minMs: 3000, maxMs: 30000 })
  a = await audio()
  result.nodes.push(a.scrim.nodes)
  result.position.push(track(a)?.position ?? 0)
  if (result.nodes[1] !== result.nodes[0]) problems.push(`score engine nodes grew while playing: ${result.nodes.join(' -> ')}`)
  if (result.nodes[1] > SCRIM_CHECK.maxNodes) problems.push(`score engine holds ${result.nodes[1]} nodes (≤ ${SCRIM_CHECK.maxNodes})`)
  if (!(result.position[1] > result.position[0] + 1)) problems.push(`the level score is not advancing (${result.position.map((p) => p.toFixed(2)).join(' -> ')} s)`)
  if (!a.scrim.ticking) problems.push('the score scheduler is not ticking')

  const burst = await page.evaluate(([shots, kills]) => window.__SC_TEST__.audioBurst(shots, kills), SCRIM_CHECK.burst)
  const v = burst.sfxVoices
  result.voices = v
  result.sfxNodes.push(burst.sfxNodes)
  if (!v) problems.push('no arcade SFX voice pool under ?audio=scrim')
  else {
    if (v.peak > v.budget) problems.push(`audioBurst(${SCRIM_CHECK.burst}) took ${v.peak} voices (budget ${v.budget})`)
    if (v.played === 0) problems.push(`audioBurst(${SCRIM_CHECK.burst}) played no arcade SFX (bank never baked?)`)
    if (v.stolen + v.rejected === 0) problems.push(`audioBurst(${SCRIM_CHECK.burst}) never stole a voice: the budget is not being exercised`)
  }
  if (burst.lateScheduleErrors) problems.push(`audioBurst: ${burst.lateScheduleErrors}/10 late note pairs threw`)
  if (burst.dropped) problems.push(`audioBurst: ${burst.dropped} sound(s) dropped by an audio error (${burst.lastDrop?.split('\n')[0]})`)
  await page.evaluate(([shots, kills]) => window.__SC_TEST__.audioBurst(shots, kills), SCRIM_CHECK.burst)
  result.sfxNodes.push((await audio()).sfxNodes)
  if (result.sfxNodes[1] !== result.sfxNodes[0] || !(result.sfxNodes[0] > 0))
    problems.push(`arcade SFX nodes not flat across two bursts: ${result.sfxNodes.join(' -> ')}`)

  await page.evaluate(() => window.__SC_TEST__.setTimeScale(0))
  result.ducked = (await until((x) => x.musicDucked, 20000)).musicDucked
  if (!result.ducked) problems.push('the score was not ducked with game time frozen')
  await page.evaluate(() => window.__SC_TEST__.setTimeScale(1))
  if ((await until((x) => !x.musicDucked, 20000)).musicDucked) problems.push('the score stayed ducked at timeScale 1')

  await page.evaluate(() => window.__SC_TEST__.setPhase('paused'))
  a = await until((x) => track(x)?.paused)
  const heldAt = track(a)?.position ?? 0
  await page.waitForTimeout(2000)
  const stillAt = track(await audio())?.position ?? 0
  await page.evaluate(() => window.__SC_TEST__.setPhase('playing'))
  const resumed = track(await until((x) => track(x) && !track(x).paused))
  result.pausedHeld = { at: heldAt, after2s: stillAt, resumedAt: resumed?.position ?? null }
  if (!track(a)?.paused) problems.push('pausing the run did not hold the score')
  else if (stillAt !== heldAt) problems.push(`the score moved while paused (${heldAt.toFixed(2)} -> ${stillAt.toFixed(2)} s)`)
  if (!resumed || resumed.paused) problems.push('resuming the run did not resume the score')
  else if (resumed.position > heldAt + 2 || resumed.position < heldAt - 0.5)
    problems.push(`the score did not resume where it stopped (${heldAt.toFixed(2)} -> ${resumed.position.toFixed(2)} s)`)

  await page.evaluate(() => window.__SC_TEST__.endLevel())
  a = await until((x) => x.scrim?.current === 'results' && !busNames(x).includes('level'))
  const levelOut = a.music.fades.findLast((f) => f.name === 'level' && f.ramp === 'out')
  const resultsIn = a.music.fades.findLast((f) => f.name === 'results' && f.ramp === 'in')
  result.results = a.scrim?.current === 'results'
  if (!result.results) problems.push(`no results score after the run (current "${a.scrim?.current}")`)
  if (!levelOut || levelOut.seconds < 0.5 || !resultsIn) problems.push('the level score did not crossfade to the results score')
  if (busNames(a).includes('level')) problems.push('the level score bus was never disposed')
  result.dropped = a.dropped
  if (a.dropped) problems.push(`${a.dropped} sound(s) dropped by an audio error (${a.lastDrop?.split('\n')[0]})`)
  return { problems, result }
}

/** Boss bar (#181) on the phone, from a paused run: resumed with the boss summoned, it must sit inside the viewport and clear of the HUD in portrait and landscape (mobile-level1-boss.png). */
async function mobileBossHud(page) {
  const selectors = [...HUD_SELECTORS, '.hud-boss']
  // Game time frozen first: the wall-clock level timer may be nearly out by now.
  await page.evaluate(() => {
    const s = window.__SC_TEST__
    s.setTimeScale(0)
    s.setPhase('playing')
    s.summonBoss()
  })
  const shown = await waitVisible(page, '.hud-boss', 30000)
  if (!shown) {
    const s = await page.evaluate(() => ({ phase: window.__SC_TEST__.phase(), stage: window.__SC_TEST__.boss().stage }))
    return { problems: [`phone: the boss bar (.hud-boss) never showed (phase ${s.phase}, boss ${s.stage})`], rects: null }
  }
  await waitFrames(page, 1, { maxMs: 8000, pollMs: 100 })
  const portrait = await hudLayoutProblems(page, 'portrait 390x844 with the boss bar', selectors)
  await page.screenshot({ path: path.join(OUT, `mobile-${MOBILE_LEVEL}-boss.png`), timeout: SHOT_TIMEOUT })
  await page.setViewportSize({ width: 844, height: 390 })
  await waitFrames(page, 2, { minMs: 500, maxMs: 8000 })
  const landscape = await hudLayoutProblems(page, 'landscape 844x390 with the boss bar', selectors)
  await page.setViewportSize({ width: 390, height: 844 })
  return { problems: [...portrait.problems, ...landscape.problems], rects: { portrait: portrait.rects, landscape: landscape.rects } }
}

/** The results screen on the phone (#87): its four buttons readable in portrait and landscape (mobile-results*.png). */
async function mobileResults(page) {
  await page.evaluate(() => window.__SC_TEST__.endLevel())
  const shown = await page
    .waitForFunction(() => document.querySelector('.results-screen')?.getAttribute('data-sequence') === 'done', null, { timeout: 60000, polling: 250 })
    .then(() => true, () => false)
  if (!shown) return { problems: ['phone: the results screen never finished its reveal'], buttons: null }
  // The buttons fade in after the reveal; frames take seconds on the phone run.
  await waitVisible(page, '.results-actions', 30000)
  await page.waitForTimeout(1500)
  const buttons = await page.evaluate(() => [...document.querySelectorAll('.results-actions button')].map((b) => b.textContent))
  const problems = await resultsActionsProblems(page, 'phone portrait 390x844')
  if (!buttons.includes('Share')) problems.push(`phone: results buttons ${JSON.stringify(buttons)} lack Share`)
  await page.screenshot({ path: path.join(OUT, 'mobile-results.png'), timeout: SHOT_TIMEOUT })
  await page.setViewportSize({ width: 844, height: 390 })
  await page.waitForTimeout(1000)
  problems.push(...(await resultsActionsProblems(page, 'phone landscape 844x390')))
  await page.screenshot({ path: path.join(OUT, 'mobile-results-landscape.png'), timeout: SHOT_TIMEOUT })
  await page.setViewportSize({ width: 390, height: 844 })
  return { problems, buttons }
}

/** Touch playtest on a phone-sized viewport: real taps through the whole flow. */
async function runMobile(browser, base) {
  const started = Date.now()
  const { defaultBrowserType: _unused, ...iphone } = devices['iPhone 13']
  // Full-screen 390x844 portrait (the descriptor's 664 px viewport assumes Safari's
  // toolbars); DPR 2 instead of 3 keeps software rendering tolerable.
  const ctx = await browser.newContext({ ...iphone, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  const errors = []
  collectErrors(page, errors)
  const problems = []
  const phase = () => page.evaluate(() => window.__SC_TEST__.phase())
  const waitPhase = (p, timeout) =>
    page.waitForFunction((want) => window.__SC_TEST__.phase() === want, p, { timeout }).catch(() => {})
  // ?seed= pins the run seed for real taps on the level card (the URL override path).
  await page.goto(`${base}/?e2e=1&seed=${SEED}`, { waitUntil: 'load' })
  await page.waitForFunction(() => !!window.__SC_TEST__, null, { timeout: 30000 })

  // Title -> PLAY (tap)
  if (!(await waitVisible(page, '.title-screen .play-button'))) problems.push('PLAY button never appeared')
  await page.locator('.title-screen .play-button').tap({ timeout: 30000 }).catch((e) => problems.push(`tap PLAY: ${e.message}`))
  await waitPhase('levelSelect', 15000)
  if ((await phase()) !== 'levelSelect') problems.push('tapping PLAY did not open level select')

  // Level select -> level 1 (tap)
  const card = `.level-card[data-level="${MOBILE_LEVEL}"]`
  if (!(await waitVisible(page, card))) problems.push('level card never appeared')
  await page.screenshot({ path: path.join(OUT, 'mobile-level-select.png'), timeout: SHOT_TIMEOUT })
  const selectLayout = await page.evaluate(() => {
    const root = document.querySelector('.level-select')
    const cards = [...document.querySelectorAll('.level-card')]
    const tooNarrow = cards.filter((c) => {
      const r = c.getBoundingClientRect()
      return r.left < 0 || r.right > window.innerWidth || r.height < 44
    })
    return { hScroll: root ? root.scrollWidth > root.clientWidth : true, bad: tooNarrow.map((c) => c.dataset.level) }
  })
  if (selectLayout.hScroll) problems.push('phone level select scrolls sideways')
  if (selectLayout.bad.length) problems.push(`phone level cards off screen or under 44 px: ${selectLayout.bad.join(',')}`)
  await page.locator(card).tap({ timeout: 30000 }).catch((e) => problems.push(`tap level: ${e.message}`))
  await waitPhase('playing', 15000)
  if ((await phase()) !== 'playing') problems.push('tapping the level card did not start the level')
  const music = await musicCrossfade(page)
  problems.push(...music.problems)
  const runSeed = await page.evaluate(() => window.__SC_TEST__.stats().runSeed)
  if (runSeed !== SEED) problems.push(`?seed=${SEED} did not set the run seed (got ${runSeed})`)

  if (!(await pollUntil(page, () => waitVisible(page, '.hud-pause-button', 500), { ms: 40000 }))) problems.push('HUD never appeared')
  await pollUntil(page, async () => (await getStats(page)).onScreenEnemies > 0, { ms: Math.max(SECONDS, 10) * 2000 })

  const portraitAspect = await aspectProblems(page, 'portrait 390x844')
  problems.push(...portraitAspect.problems)

  // 10 taps, each offset 15-30 px from the nearest on-screen enemy (touch aim assist).
  const portraitTaps = await offsetTapKills(page, 'portrait')
  problems.push(...portraitTaps.problems)
  const { tapsOnEnemies, tapShots, tapKills } = portraitTaps.result
  const crosshairScale = await page.evaluate(() => {
    const el = document.querySelector('.crosshair-svg')
    return el ? new DOMMatrixReadOnly(getComputedStyle(el).transform).a : 0
  })
  if (Math.abs(crosshairScale - 1.25) > 0.01) problems.push(`crosshair not in touch mode (scale ${crosshairScale})`)

  // If the taps got no kill (already reported), killNearest(3) still sets up the
  // screenshot / HUD checks below (3 so the combo counter shows in its phone position).
  let fallbackKills = 0
  if (tapKills === 0) {
    const killEventsBefore = await page.evaluate(() => window.__SC_TEST__.combat.kills)
    fallbackKills = await page.evaluate(() => window.__SC_TEST__.killNearest(3))
    // enemy:killed (explosion, HUD enemy count) follows the ~80 ms kill pop, and
    // the pop freezes once game time is frozen below — let it finish first.
    const popDeadline = Date.now() + 20000
    let killEvents = killEventsBefore
    do {
      await waitFrames(page, 1, { maxMs: 5000, pollMs: 30 })
      killEvents = await page.evaluate(() => window.__SC_TEST__.combat.kills)
    } while (Date.now() < popDeadline && killEvents - killEventsBefore < fallbackKills)
    if (fallbackKills > 0 && killEvents === killEventsBefore) problems.push('killNearest hits did not produce an enemy:killed event')
  }
  // The level timer runs on wall-clock time, so on a slow runner the level can
  // time out (HUD unmounts) before the layout + pause checks. Freeze game time
  // now that the touch-input checks are done; pause still works while frozen.
  if ((await phase()) !== 'playing') problems.push(`level left 'playing' (${await phase()}) before the HUD layout checks`)
  // One more real tap with feedback held, so the screenshot shows the weapon's
  // muzzle flash + tracer (#65); then freeze game time with them on screen.
  {
    const vp = page.viewportSize()
    const [pt] = await page.evaluate(() => {
      window.__SC_TEST__.holdFeedback = true
      return window.__SC_TEST__.enemyScreenPoints(1)
    })
    const x = Math.min(Math.max(pt?.x ?? vp.width / 2, 8), vp.width - 8)
    const y = Math.min(Math.max(pt?.y ?? vp.height / 2, 8), vp.height - 80)
    await page.touchscreen.tap(x, y)
    await waitFrames(page, 1, { minMs: 80, maxMs: 4000, pollMs: 40 })
  }
  await page.evaluate(() => window.__SC_TEST__.setTimeScale(0))
  await page.screenshot({ path: path.join(OUT, `mobile-${MOBILE_LEVEL}.png`), timeout: SHOT_TIMEOUT })
  // PLAY was a real tap, so audio is unlocked here: the SFX kit exists now (it was
  // used by the taps) and its node count must not grow with more shots / kills.
  // Frozen time counts as slow-mo, so the music low-pass must be ducked.
  const audioPortrait = await page.evaluate(() => window.__SC_TEST__.audio())
  if (audioPortrait.ready) {
    if (audioPortrait.sfxNodes === 0) problems.push('audio unlocked but no SFX nodes after shooting')
    if (!audioPortrait.musicDucked) problems.push('music not ducked with game time frozen (slow-mo low-pass)')
  }
  const burstPortrait = await audioBurstProblems(page, 'portrait')
  problems.push(...burstPortrait.problems)
  const weaponPortrait = await weaponProblems(page, 'portrait 390x844')
  problems.push(...weaponPortrait.problems)
  const end = await getStats(page)
  if (end.kills === 0 && end.score <= 0) problems.push('no kill reached')

  const portrait = await hudLayoutProblems(page, 'portrait 390x844')
  problems.push(...portrait.problems)

  await page.setViewportSize({ width: 844, height: 390 })
  await waitFrames(page, 2, { minMs: 500, maxMs: 8000 })
  const landscapeAspect = await aspectProblems(page, 'landscape 844x390 (rotated)')
  problems.push(...landscapeAspect.problems)
  const landscape = await hudLayoutProblems(page, 'landscape 844x390')
  problems.push(...landscape.problems)
  // Offset taps must also land in landscape; wait for a target first.
  const lsEnemyDeadline = Date.now() + 20000
  while (Date.now() < lsEnemyDeadline && (await getStats(page)).onScreenEnemies === 0) {
    await page.evaluate(() => window.__SC_TEST__.setTimeScale(1))
    await waitFrames(page, 1, { maxMs: 4000, pollMs: 100 })
  }
  const landscapeTaps = (await phase()) === 'playing'
    ? await offsetTapKills(page, 'landscape')
    : { result: null, problems: [`landscape: level left 'playing' (${await phase()}) before the taps`] }
  problems.push(...landscapeTaps.problems)
  await page.evaluate(() => window.__SC_TEST__.setTimeScale(0))
  await waitFrames(page, 1, { maxMs: 5000, pollMs: 40 })
  await page.screenshot({ path: path.join(OUT, `mobile-${MOBILE_LEVEL}-landscape.png`), timeout: SHOT_TIMEOUT })
  const audioLandscape = await page.evaluate(() => window.__SC_TEST__.audio())
  if (audioPortrait.ready && audioLandscape.sfxNodes !== audioPortrait.sfxNodes)
    problems.push(`SFX nodes grew while playing: ${audioPortrait.sfxNodes} -> ${audioLandscape.sfxNodes} (audio nodes created per shot/kill)`)
  const burstLandscape = await audioBurstProblems(page, 'landscape (rotated)')
  problems.push(...burstLandscape.problems)
  const weaponLandscape = await weaponProblems(page, 'landscape 844x390')
  problems.push(...weaponLandscape.problems)
  const bullets = await page.evaluate(() => window.__SC_TEST__.bullets())
  if (bullets.maxScreenFrac > BULLET_SCREEN_CAP)
    problems.push(`a bullet covered ${(bullets.maxScreenFrac * 100).toFixed(1)}% of the canvas height (cap ${BULLET_SCREEN_CAP * 100}%)`)
  await page.evaluate(() => { window.__SC_TEST__.holdFeedback = false })

  // Back to normal speed: the music low-pass must open again.
  await page.evaluate(() => window.__SC_TEST__.setTimeScale(1))
  await waitFrames(page, 1, { maxMs: 5000, pollMs: 40 })
  if (audioPortrait.ready && (await page.evaluate(() => window.__SC_TEST__.audio().musicDucked)))
    problems.push('music still ducked at timeScale 1')

  // Pause is a button (touch has no Escape key).
  if ((await phase()) !== 'playing') problems.push(`level left 'playing' (${await phase()}) before the pause tap`)
  await page.locator('.hud-pause-button').tap({ timeout: 30000 }).catch((e) => problems.push(`tap pause: ${e.message}`))
  await waitPhase('paused', 15000)
  if ((await phase()) !== 'paused') problems.push('tapping Pause did not pause')
  let pauseCards = null
  // Phone frames take seconds under software GL: the HUD fades out before the menu fades in.
  if (await waitVisible(page, '.pause-card', 60000)) {
    const landscapeCard = await pauseCardLayout(page)
    problems.push(...landscapeCard.problems.map((p) => `phone landscape 844x390: ${p}`))
    await page.screenshot({ path: path.join(OUT, 'mobile-pause-landscape.png'), timeout: SHOT_TIMEOUT })
    pauseCards = { landscape: landscapeCard.rect }
  } else problems.push('phone: the pause card never showed')

  // Rotate back to portrait: the camera must follow again.
  await page.setViewportSize({ width: 390, height: 844 })
  await waitFrames(page, 2, { minMs: 500, maxMs: 8000 })
  const backAspect = await aspectProblems(page, 'portrait 390x844 (rotated back)')
  problems.push(...backAspect.problems)
  if (pauseCards) {
    const portraitCard = await pauseCardLayout(page)
    problems.push(...portraitCard.problems.map((p) => `phone portrait 390x844: ${p}`))
    await page.screenshot({ path: path.join(OUT, 'mobile-pause.png'), timeout: SHOT_TIMEOUT })
    pauseCards.portrait = portraitCard.rect

    // Settings from the pause menu (#35): fits 390 px, Back returns to the menu (mobile-settings.png).
    await page.getByRole('button', { name: 'Settings' }).tap({ timeout: 30000 }).catch((e) => problems.push(`tap Settings: ${e.message}`))
    if (await waitVisible(page, '.settings-card', 60000)) {
      const settings = await settingsLayout(page, 'phone portrait 390x844')
      problems.push(...settings.problems)
      await page.screenshot({ path: path.join(OUT, 'mobile-settings.png'), timeout: SHOT_TIMEOUT })
      pauseCards.settings = settings.rect
      await page.locator('.settings-back').tap({ timeout: 30000 }).catch((e) => problems.push(`tap settings Back: ${e.message}`))
      if (!(await waitVisible(page, '.pause-card', 60000))) problems.push('phone: Back from settings did not return to the pause menu')
    } else problems.push('phone: Settings in the pause menu never opened')
  }

  const bossHud = (await phase()) === 'paused' ? await mobileBossHud(page) : { problems: [], rects: null }
  problems.push(...bossHud.problems)

  const resultsLayout = await mobileResults(page)
  problems.push(...resultsLayout.problems)

  const hookErrors = await page.evaluate(() => window.__SC_TEST__.errors)
  const allErrors = [...errors, ...hookErrors]
  if (allErrors.length) problems.push(`${allErrors.length} error(s)`)
  await ctx.close()
  return {
    id: `mobile-${MOBILE_LEVEL}`,
    ok: problems.length === 0,
    problems,
    seconds: (Date.now() - started) / 1000,
    mobile: {
      taps: 10, tapsOnEnemies, tapShots, tapKills, fallbackKills, crosshairScale,
      portraitTaps: portraitTaps.result, landscapeTaps: landscapeTaps.result,
      audio: { portrait: audioPortrait, landscape: audioLandscape, music: music.result },
      audioBurst: { portrait: burstPortrait.burst, landscape: burstLandscape.burst },
      views: { portrait: portraitAspect.view, landscape: landscapeAspect.view, portraitAgain: backAspect.view },
      bulletMaxScreenFrac: bullets.maxScreenFrac,
      pauseCards,
      resultsButtons: resultsLayout.buttons,
    },
    kills: end.kills,
    score: end.score,
    hud: { portrait: portrait.rects, landscape: landscape.rects, boss: bossHud.rects },
    weapon: { portrait: weaponPortrait.box, landscape: weaponLandscape.box },
    errors: allErrors,
  }
}

async function run() {
  const runStarted = Date.now()
  const base = args.url ?? (preview = await startPreview()).url
  const browser = await launch()
  const results = []
  let failed = false

  const newPage = async (query = 'e2e=1', options = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...options })
    // The results Share check reads back what it copied (#87).
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'])
    const page = await ctx.newPage()
    const errors = []
    collectErrors(page, errors)
    await page.goto(`${base}/?${query}`, { waitUntil: 'load' })
    await page.waitForFunction(() => !!window.__SC_TEST__, null, { timeout: 30000 })
    return { ctx, page, errors }
  }

  // 1. Title screen
  const t = await newPage()
  const levels = await t.page.evaluate(() => window.__SC_TEST__.levels())
  const titleWait = await waitFrames(t.page, MIN_FRAMES, { maxMs: FRAME_DEADLINE_MS, pollMs: 500 })
  const titlePng = await t.page.screenshot({ path: path.join(OUT, 'title.png'), timeout: SHOT_TIMEOUT })
  const titleImg = await imageStats(t.page, titlePng)
  const fly = await titleFlyBy(t.page)
  const titleProblems = [...fly.problems, ...(await fontProblems(t.page))]
  if (titleWait.frames < MIN_FRAMES) titleProblems.push(`render loop stalled (${titleWait.frames} frames in ${(titleWait.ms / 1000).toFixed(0)}s)`)
  if (titleImg.stddev <= 4) titleProblems.push('title.png is blank')
  if (t.errors.length) titleProblems.push(`${t.errors.length} error(s)`)
  const titleOk = titleProblems.length === 0
  failed ||= !titleOk
  results.push({ id: 'title', ok: titleOk, problems: titleProblems, frames: titleWait.frames, frameSeconds: titleWait.ms / 1000, image: titleImg, title: fly.result, errors: t.errors })
  await t.ctx.close()

  // 1b. Level select with saved progress + keyboard-only start
  if (!args['skip-desktop']) {
    const l = await newPage()
    const r = await levelSelectCheck(l.page, levels)
    r.errors = [...l.errors, ...(await l.page.evaluate(() => window.__SC_TEST__.errors))]
    if (r.errors.length) r.problems.push(`${r.errors.length} error(s)`)
    r.ok = r.problems.length === 0
    failed ||= !r.ok
    results.push(r)
    await l.ctx.close()
  }

  // 1b'. Daily Run from its card: today's seed, same spawns on a second load, daily results, campaign saves untouched
  if (!args['skip-desktop']) {
    const r = await dailyCheck(newPage)
    failed ||= !r.ok
    results.push(r)
  }

  // 1c. Settings from the title (settings.png): layout, Esc, persisted across a reload
  if (!args['skip-desktop']) {
    const st = await newPage()
    const r = await settingsCheck(st.page)
    r.errors = [...st.errors, ...(await st.page.evaluate(() => window.__SC_TEST__.errors))]
    if (r.errors.length) r.problems.push(`${r.errors.length} error(s)`)
    r.ok = r.problems.length === 0
    failed ||= !r.ok
    results.push(r)
    await st.ctx.close()
  }

  // 2. Every level (or the requested subset)
  const wanted = args['skip-desktop'] ? [] : args.levels ? args.levels.split(',') : levels.map((l) => l.id)
  for (const id of wanted) {
    const { ctx, page, errors } = await newPage()
    const started = Date.now()
    await page.evaluate(([lid, seed]) => window.__SC_TEST__.startLevel(lid, seed), [id, SEED])
    const ride = await waitFrames(page, MIN_FRAMES, { minMs: SECONDS * 1000, maxMs: FRAME_DEADLINE_MS, pollMs: 500 })
    const stats = await page.evaluate(() => {
      const s = window.__SC_TEST__
      return { avgFrameMs: s.avgFrameMs, drawCalls: s.drawCalls, triangles: s.triangles, phase: s.phase(), hookErrors: s.errors, scene: s.sceneStats?.() ?? null, particles: s.particles() }
    })
    const png = await page.screenshot({ path: path.join(OUT, `${id}.png`), timeout: SHOT_TIMEOUT })
    const img = await imageStats(page, png)
    const enemyShot = await captureEnemyCloseup(page, id)
    const { frames } = ride
    const frameSeconds = ride.ms / 1000
    const problems = []
    const spawnDigest = await nextSpawnDigest(page, null)
    if (!spawnDigest) problems.push('spawnDigest() never reported the spawns')

    if (frames < MIN_FRAMES) problems.push(`render loop stalled (${frames} frames in ${frameSeconds.toFixed(0)}s)`)
    if (img.stddev < 4 || img.distinctColors < 8) problems.push('frame looks blank')
    if (stats.phase !== 'playing') problems.push(`unexpected phase "${stats.phase}" after ride`)
    if (enemyShot.error) problems.push(`enemy probe failed: ${enemyShot.error}`)
    else if (enemyShot.readable < MIN_READABLE) {
      problems.push(`${enemyShot.readable} readable enemies (≥ ${READABLE_PX} px) of ${enemyShot.onScreen} on screen after the ride (need ${MIN_READABLE})`)
    }
    if (stats.scene && !stats.scene.environment) problems.push('no scene.environment (sky env map not baked)')
    if (!stats.particles.mounted || stats.particles.points <= 0) problems.push('no ambient particle field (BiomeDefinition.particles)')
    const desktopAspect = await aspectProblems(page, 'desktop 1280x720')
    problems.push(...desktopAspect.problems)
    stats.view = desktopAspect.view
    const perfGate = PERF_GATE ? sceneBudgetCheck(id, stats) : null
    if (perfGate?.over.length && !perfGate.knownOver) problems.push(`over budget: ${perfGate.over.join(', ')}`)
    const play = await playLevel(page, id, { frenzy: id === wanted[0] })
    problems.push(...play.problems)
    const hookErrors = await page.evaluate(() => window.__SC_TEST__.errors)
    const allErrors = [...errors, ...hookErrors]
    if (allErrors.length) problems.push(`${allErrors.length} error(s)`)
    const ok = problems.length === 0
    failed ||= !ok
    delete stats.hookErrors
    results.push({
      id, ok, problems, frames, frameSeconds, seconds: (Date.now() - started) / 1000, spawnDigest, ...stats, perfGate,
      kills: play.kills, score: play.score, combat: play.combat, results: play.results, image: img, enemies: enemyShot, errors: allErrors,
    })
    await ctx.close()
  }

  // 2b. ?quality=low against the default: dpr 1, no contact shadows, fewer draw calls (<id>-low.png)
  if (wanted.length) {
    const r = await qualityCheck(newPage, wanted[0])
    if (r.errors.length) r.problems.push(`${r.errors.length} error(s)`)
    r.ok = r.problems.length === 0
    failed ||= !r.ok
    results.push(r)
  }

  // 3. Seeded spawns: a fresh page + the same seed gives the same enemies; another seed doesn't
  const firstLevel = results.find((r) => r.id === wanted[0])
  if (firstLevel?.spawnDigest) {
    const s = await newPage()
    const r = await seedCheck(s.page, firstLevel)
    r.errors = s.errors
    failed ||= !r.ok
    results.push(r)
    await s.ctx.close()
  }

  // 4. Leaving the tab pauses the run and never drains the timer
  if (wanted.length) {
    const h = await newPage()
    const r = await hiddenPauseCheck(h.page, wanted[0])
    r.errors = [...h.errors, ...(await h.page.evaluate(() => window.__SC_TEST__.errors))]
    if (r.errors.length) r.problems.push(`${r.errors.length} error(s)`)
    r.ok = r.problems.length === 0
    failed ||= !r.ok
    results.push(r)
    // 4b. The pause menu on the same page (pause.png): focus, Esc resume, Restart
    const errorsBefore = r.errors.length
    const m = await pauseMenuCheck(h.page, wanted[0])
    m.errors = [...h.errors, ...(await h.page.evaluate(() => window.__SC_TEST__.errors))].slice(errorsBefore)
    if (m.errors.length) m.problems.push(`${m.errors.length} error(s)`)
    m.ok = m.problems.length === 0
    failed ||= !m.ok
    results.push(m)
    await h.ctx.close()
  }

  // 5. A real start: Ready / Set / GO over the warming-up level, then playing
  if (wanted.length) {
    const c = await newPage('e2e=1&countdown=1')
    const r = await countdownCheck(c.page, wanted[0])
    r.errors = [...c.errors, ...(await c.page.evaluate(() => window.__SC_TEST__.errors))]
    if (r.errors.length) r.problems.push(`${r.errors.length} error(s)`)
    r.ok = r.problems.length === 0
    failed ||= !r.ok
    results.push(r)
    await c.ctx.close()
  }

  // 6. Top speed: banking + wind streaks (speed.png)
  if (wanted.length) {
    const sp = await newPage()
    const r = await speedCheck(sp.page, wanted[0])
    r.errors = [...sp.errors, ...(await sp.page.evaluate(() => window.__SC_TEST__.errors))]
    if (r.errors.length) r.problems.push(`${r.errors.length} error(s)`)
    r.ok = r.problems.length === 0
    failed ||= !r.ok
    results.push(r)
    await sp.ctx.close()
  }

  // 6b. Spawn choreography: the crow wave's tell, then its V flying in (level2-wave.png)
  if (wanted.includes(WAVE_CHECK.level)) {
    const w = await newPage()
    const r = await waveCheck(w.page)
    r.errors = [...w.errors, ...(await w.page.evaluate(() => window.__SC_TEST__.errors))]
    if (r.errors.length) r.problems.push(`${r.errors.length} error(s)`)
    r.ok = r.problems.length === 0
    failed ||= !r.ok
    results.push(r)
    await w.ctx.close()
  }

  // 6c. The finales: summoned, shot down in phase order (<level>-boss.png, <level>-boss-down.png)
  for (const check of BOSS_CHECKS.filter((c) => wanted.includes(c.level))) {
    const b = await newPage()
    const r = await bossCheck(b.page, check)
    r.errors = [...b.errors, ...(await b.page.evaluate(() => window.__SC_TEST__.errors))]
    if (r.errors.length) r.problems.push(`${r.errors.length} error(s)`)
    r.ok = r.problems.length === 0
    failed ||= !r.ok
    results.push(r)
    await b.ctx.close()
  }

  // 6e. Weapon pickups: one shot with a real bullet, the fan, the badge, expiry (level1-pickup.png)
  if (wanted.includes(PICKUP_CHECK.level)) {
    const pk = await newPage()
    const r = await pickupCheck(pk.page)
    r.errors = [...pk.errors, ...(await pk.page.evaluate(() => window.__SC_TEST__.errors))]
    if (r.errors.length) r.problems.push(`${r.errors.length} error(s)`)
    r.ok = r.problems.length === 0
    failed ||= !r.ok
    results.push(r)
    await pk.ctx.close()
  }

  // 6d. The score engine behind ?audio=scrim: title -> level -> pause -> results
  if (wanted.includes(SCRIM_CHECK.level)) {
    const sc = await newPage('e2e=1&audio=scrim')
    const r = await scrimCheck(sc.page)
    const errors = [...sc.errors, ...(await sc.page.evaluate(() => window.__SC_TEST__.errors))]
    if (errors.length) r.problems.push(`${errors.length} error(s)`)
    const ok = r.problems.length === 0
    failed ||= !ok
    results.push({ id: 'scrim', ok, problems: r.problems, scrim: r.result, errors })
    await sc.ctx.close()
  }

  // 7. Optional touch playtest on a phone viewport
  if (args.mobile) {
    const m = await runMobile(browser, base)
    failed ||= !m.ok
    results.push(m)
  }

  await browser.close()
  if (preview) stopPreview(preview.proc)

  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2))
  for (const r of results) {
    const en = r.enemies && !r.enemies.error
      ? ` enemiesOnScreen=${r.enemies.onScreen} readable=${r.enemies.readable} largestPx=${r.enemies.largestPx}`
      : ''
    const extra = r.id === 'title'
      ? (r.title ? ` 6 s later: turned ${r.title.turnedDeg.toFixed(1)} deg, moved ${r.title.moved.toFixed(0)}; hint "${r.title.hint}"; key -> ${r.title.opened ? 'levelSelect' : 'stuck'}` : '')
      : r.daily
        ? ` ${r.daily.dateKey} ${r.daily.level} seed=${r.daily.seed} digest=${r.daily.digest} again=${r.daily.digestAgain} record=${r.daily.record} replaySeed=${r.daily.replaySeed}`
      : r.levelSelect
        ? ` cards=${r.levelSelect.cards} locked=${r.levelSelect.locked} stars=${r.levelSelect.total}` +
          (r.levelSelect.keyboard ? ` keys: ${r.levelSelect.focused} <- ${r.levelSelect.keyboard.left}, locked ${r.levelSelect.keyboard.locked} Enter -> ${r.levelSelect.keyboard.phaseAfterLocked}, Enter -> ${r.levelSelect.keyboard.level} ${r.levelSelect.keyboard.phase}` : '')
      : r.settings
        ? ` card ${JSON.stringify(r.settings.card)} quality ${r.settings.quality.join(' -> ')} (reload) music ${r.settings.musicVolume}`
      : r.quality
        ? ` ${r.quality.level} draws default=${r.quality.drawCalls[0]} low=${r.quality.drawCalls[1]} dpr ${r.quality.dpr.join(' -> ')}`
      : r.seedCheck
        ? ` ${r.seedCheck.level} seed ${SEED}: ${r.seedCheck.digest} (reload ${r.seedCheck.reloaded}, again ${r.seedCheck.again}) seed ${SEED + 1}: ${r.seedCheck.other}`
      : r.hiddenPause
        ? ` ${r.hiddenPause.level} timer ${r.hiddenPause.before.toFixed(1)} -> after 5s hidden ${r.hiddenPause.whileHidden.toFixed(1)}` +
          ` -> ${r.hiddenPause.resumed.toFixed(1)} after ${r.hiddenPause.resumedSeconds.toFixed(0)}s resumed, trigger held ${r.hiddenPause.heldBefore}->${r.hiddenPause.heldAfter},` +
          ` kills ${r.hiddenPause.kills.join('->')}, live ${r.hiddenPause.liveEnemies.join('->')},` +
          ` ride ${r.hiddenPause.ride.map((t) => t.toFixed(4)).join('->')}, wave due ${r.hiddenPause.wave.due}s arrived ${typeof r.hiddenPause.wave.arrivedAt === 'number' ? r.hiddenPause.wave.arrivedAt.toFixed(2) + 's' : r.hiddenPause.wave.arrivedAt}`
      : r.pauseMenu
        ? ` ${r.pauseMenu.level} card ${JSON.stringify(r.pauseMenu.card)}, focus ${r.pauseMenu.focusOnOpen} -> ${r.pauseMenu.afterArrow},` +
          ` restart ride ${r.pauseMenu.restart.ride.map((t) => t.toFixed(4)).join('->')} level time ${r.pauseMenu.restart.levelTime.map((t) => t?.toFixed(1)).join('->')}`
      : r.countdown
        ? ` ${r.countdown.level} "${r.countdown.stepText}" timer ${r.countdown.timerDuring.toFixed(1)} -> ${r.countdown.timerAtGo.toFixed(1)} at GO,` +
          ` held into play: ${r.countdown.shotsHeldIntoPlay} shots, replay tap in ${r.countdown.skipTapIn},` +
          ` shader warm-up ${r.countdown.warmup?.done ? `${r.countdown.warmup.ms.toFixed(0)} ms, ${r.countdown.warmup.programs} programs` : 'unfinished'},` +
          ` first shot: programs ${r.countdown.firstShot.programs} -> ${r.countdown.firstShot.programsAfter}, longest frame ${r.countdown.firstShot.maxFrameMs.toFixed(0)} ms (avg ${r.countdown.firstShot.avgFrameMs.toFixed(0)})` +
          ` | startup ${startupSummary(r.initTimings)}`
      : r.wave
        ? ` ${r.wave.level} tell ${r.wave.tellLeadS?.toFixed(1) ?? '-'}s ahead, on screen ${r.wave.onScreen} (largest ${r.wave.largestPx}px, nearest ${r.wave.nearest})`
      : r.boss
        ? (r.boss.skipped
          ? ` ${r.boss.level} skipped (level timed out)`
          : ` ${r.boss.level} tell "${r.boss.tell.at(-1) ?? '-'}" draws=${r.boss.drawCalls} width ${(r.boss.widthFrac * 100).toFixed(0)}% exposed [${r.boss.exposedAtStart.length} ${r.boss.exposedAtStart[0] ?? '-'}…] -> [${r.boss.exposedMidway}]` +
            ` bullet hit ${r.boss.bulletHit} hits ${r.boss.phaseOneHits}+${r.boss.lastHits} kills ${r.boss.kills} score +${r.boss.score} popup ${r.boss.popup[0] ?? '-'} stage ${r.boss.stage}`)
      : r.pickup
        ? ` ${r.pickup.count} pickups [${r.pickup.ids.join(',')}] draws=${r.pickup.drawCalls} first at ${r.pickup.px ? `${r.pickup.px.x},${r.pickup.px.y} (${r.pickup.px.distance} units, lead ${r.pickup.lead})` : '-'}` +
          ` fan shots=${r.pickup.fan?.shots} drawn=${r.pickup.fan?.drawn}`
      : r.scrim
        ? ` engine=${r.scrim.engine} title=${r.scrim.title} nodes ${r.scrim.nodes.join('->')} position ${r.scrim.position.map((p) => p.toFixed(1)).join('->')}s` +
          ` sfxNodes ${r.scrim.sfxNodes.join('->')} voices ${r.scrim.voices ? `peak ${r.scrim.voices.peak}/${r.scrim.voices.budget} stolen ${r.scrim.voices.stolen} dropped ${r.scrim.voices.rejected}` : 'none'}` +
          ` ducked=${r.scrim.ducked} paused at ${r.scrim.pausedHeld?.at.toFixed(1)}s (${r.scrim.pausedHeld?.after2s.toFixed(1)} 2 s later, resumed ${r.scrim.pausedHeld?.resumedAt?.toFixed(1)}) results=${r.scrim.results}`
      : r.speed
        ? ` ${r.speed.level} at track ${r.speed.fraction}: speed ${r.speed.speed.toFixed(2)} streaks ${r.speed.streaks.toFixed(2)} ${weightSummary(r.speed)}`
      : r.mobile
        ? ` taps=${r.mobile.taps} (on enemies ${r.mobile.tapsOnEnemies}) tapShots=${r.mobile.tapShots}` +
          ` tapKills=${r.mobile.tapKills} landscapeTapKills=${r.mobile.landscapeTaps?.tapKills ?? '-'}` +
          ` fallbackKills=${r.mobile.fallbackKills} sfxNodes=${audioSummary(r.mobile.audio)} audioBurst=${burstSummary(r.mobile.audioBurst.portrait)}/${burstSummary(r.mobile.audioBurst.landscape)} gunAimErr=${r.weapon?.portrait?.aimErrorDeg?.toFixed(0)}°/${r.weapon?.landscape?.aimErrorDeg?.toFixed(0)}° kills=${r.kills} score=${r.score}${viewSummary(r.mobile.views)} ${r.seconds.toFixed(0)}s`
      : ` draws=${r.drawCalls} tris=${r.triangles} avgFrameMs=${r.avgFrameMs?.toFixed(1)}${sceneSummary(r.scene)}${en}` +
        ` particles=${r.particles?.points ?? '-'}${r.particles?.boostPoints ? `+${r.particles.boostPoints}` : ''}` +
        ` kills=${r.kills} (autofire ${r.combat.autofireKills}, shots ${r.combat.shotsFired}, mouse shots ${r.combat.mouseShots}) score=${r.score}` +
        ` audioBurst=${burstSummary(r.combat.audioBurst)} translationMax=${r.combat.translationMax?.toFixed(2)} traumaMax=${r.combat.traumaMaxDeg?.toFixed(2)}° weight=${weightSummary(r.combat.cameraWeight)} gunAimErr=${r.combat.freshShot?.aimErrorDeg?.toFixed(0)}° aimJump=${r.combat.freshShot?.aimJump?.aimErrorDeg?.toFixed(0)}°(turn ${r.combat.freshShot?.aimJump?.jumpDeg?.toFixed(0)}°) bullets=${bulletSummary(r.combat.freshShot)}${r.combat.fireworks ? ` fireworks=${r.combat.fireworks.launched}/${r.combat.fireworks.bursts}` : ''}${r.combat.deaths?.lastStyle ? ` death=${r.combat.deaths.lastStyle}${r.combat.deaths.last?.onScreen ? '' : '(off-screen)'}` : ''}${resultsSummary(r.results)}${r.combat.killCheckSkipped ? ' killEvent=skipped(level timed out)' : ''} ${r.seconds.toFixed(0)}s`
    console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.id.padEnd(10)}${r.frames === undefined ? '' : ` frames=${r.frames} in ${r.frameSeconds.toFixed(1)}s`}${extra}${r.problems?.length ? ' — ' + r.problems.join('; ') : ''}`)
    if (r.perfGate?.knownOver && r.perfGate.over.length) console.log(`     WARN over budget (known, ${r.perfGate.knownOver}): ${r.perfGate.over.join(', ')}`)
    for (const e of r.errors.slice(0, 5)) console.log(`     ${e}`)
  }
  console.log(`Screenshots + results.json in ${OUT} (total ${((Date.now() - runStarted) / 1000).toFixed(0)}s)`)
  process.exit(failed ? 1 : 0)
}

/** Level phases from the run's start: the smoke picks when that is. */
function startupSummary(t) {
  const ms = (v) => (v === undefined ? '-' : `${v}`)
  const sinceRun = (v) => (v === undefined || t.runStart === undefined ? '-' : `+${v - t.runStart}`)
  return `boot=${ms(t.boot)} titleFrame=${ms(t.titleFrame)} playReady=${ms(t.playReady)} ms;` +
    ` run at ${ms(t.runStart)}: mounted=${sinceRun(t.levelMounted)} env=${sinceRun(t.envBaked)}` +
    ` warmup=${sinceRun(t.warmupDone)} playing=${sinceRun(t.firstPlayingFrame)} ms`
}

function resultsSummary(s) {
  return s ? ` results=${s.stars}★ acc=${s.rows.Accuracy} combo=${s.rows['Best combo']}` : ''
}

/** audioBurst result: "ok", or late-note throws + dropped sounds. */
/** Largest bullet screen radius (% of canvas height) since load, and the fresh shot's distance from the muzzle tip. */
function bulletSummary(b) {
  if (!b) return '?'
  const tip = b.tipDistPx == null ? '' : ` tip+${b.tipDistPx.toFixed(0)}px`
  if (b.skipped) return 'shot skipped (level ended)'
  return `muzzle ${(b.muzzleFrac * 100).toFixed(2)}% flight ${(b.flightFrac * 100).toFixed(2)}% max ${(b.maxScreenFrac * 100).toFixed(2)}%${tip}`
}

function burstSummary(b) {
  if (!b) return '-'
  return b.lateScheduleErrors || b.dropped ? `late${b.lateScheduleErrors}+drop${b.dropped}` : 'ok'
}

/** SFX node count after the portrait / landscape taps (equal = no per-shot nodes). */
function audioSummary(a) {
  return a?.portrait?.ready ? `${a.portrait.sfxNodes}/${a.landscape.sfxNodes}` : 'locked'
}

/** Coaster camera weight now / max since load, for the summary line. */
const weightSummary = (w) =>
  w ? `roll ${w.roll.toFixed(1)}/${w.maxRoll.toFixed(1)}° pitch ${w.pitch.toFixed(1)}/${w.maxPitch.toFixed(1)}° fov+${w.fovKick.toFixed(1)}/${w.maxFovKick.toFixed(1)}°` : '-'

/** Camera vs canvas aspect + FOV per mobile orientation, for the summary line. */
function viewSummary(views) {
  if (!views) return ''
  const f = (v) => (v ? `${v.cameraAspect?.toFixed(2)}/${v.canvasAspect.toFixed(2)} fov ${v.fov?.toFixed(0)}x${v.hFov?.toFixed(0)}` : '-')
  const b = (v) => (v ? `${v.bufferWidth}x${v.bufferHeight}@${v.dpr?.toFixed(2)}` : '-')
  return ` buffer portrait=${b(views.portrait)} landscape=${b(views.landscape)} aspect cam/canvas portrait=${f(views.portrait)} landscape=${f(views.landscape)} back=${f(views.portraitAgain)}`
}

function trackTotals(scene) {
  if (!scene) return null
  const total = { objects: 0, triangles: 0 }
  for (const [name, e] of Object.entries(scene.byName)) {
    if (name.startsWith('track')) { total.objects += e.objects; total.triangles += e.triangles }
  }
  return total
}

/** Camera-independent totals: whole scene, and objects whose name starts with "track". */
function sceneSummary(scene) {
  if (!scene) return ''
  const track = trackTotals(scene)
  const env = scene.environment
  const envText = env ? ` env=${env.intensity} bake=${env.bakeMs?.toFixed(1)}ms` : ' env=none'
  return ` | scene objs=${scene.objects} tris=${scene.triangles} (track objs=${track.objects} tris=${track.triangles})${envText}`
}

run().catch((e) => {
  console.error(e)
  if (preview) stopPreview(preview.proc) // don't leak the vite preview server on failure
  process.exit(1)
})
