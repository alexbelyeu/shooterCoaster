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
 * the first-person weapon is missing / off screen / covering the centre, the
 * camera aspect doesn't match the canvas, or the results screen never appears.
 * Saves screenshots + stats to e2e-results/.
 *
 * All waits are deadline-polled on the hook's frame counter, because software
 * rendering in CI / cloud sessions can run at ~1 fps.
 *
 * Usage:
 *   npm run build && node e2e/smoke.mjs                 # all levels
 *   node e2e/smoke.mjs --levels level1,level5 --seconds 12 --combat-seconds 6
 *   node e2e/smoke.mjs --url https://example.com        # test a deployed site
 *   node e2e/smoke.mjs --mobile                         # + touch playtest on a phone viewport
 *   node e2e/smoke.mjs --mobile --skip-desktop          # only the touch playtest
 *
 * --mobile: iPhone 13-like context (390x844, touch, mobile UA) that taps PLAY,
 * taps level 1, then in portrait and again after rotating to 844x390 landscape
 * taps the canvas 10x at on-screen enemies, each tap offset 15-30 px from the
 * enemy (game time frozen while tapping), and requires the taps to fire and
 * kill through touch aim assist. Checks the camera aspect matches the canvas
 * (±0.01) in portrait, landscape and after rotating back (also on desktop for
 * every level), that HUD elements are inside the viewport and don't overlap in
 * both orientations, then taps Pause. Saves mobile-level1.png and
 * mobile-level1-landscape.png.
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
// SwiftShader on a shared 2-core box can take >30s (Playwright's default) to produce
// a frame for the heavier biomes; a slow screenshot is not a game bug.
const SHOT_TIMEOUT = Number(args['shot-timeout'] ?? 120000)
const COMBAT_SECONDS = Number(args['combat-seconds'] ?? 4)
const COMBAT_MIN_FRAMES = Number(args['combat-min-frames'] ?? 4)
let preview // module scope so the top-level catch can kill it
fs.mkdirSync(OUT, { recursive: true })

// Console noise that is expected in headless/sandboxed runs and is not a game bug.
const IGNORED = [
  /AudioContext/i,
  /googletagmanager|gtag|google-analytics/i,
  /Failed to load resource/i,
  /net::ERR_/i,
  /WebGL.*(performance|GPU stall|ReadPixels)/i,
  /THREE\.WebGLRenderer: .*(extension|precision)/i,
  /Download the React DevTools/i,
]
const ignored = (msg) => IGNORED.some((re) => re.test(msg))

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
    url = `http://localhost:${port}`
    if (!(await portInUse(url))) break
  }
  const proc = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    // Own process group, so stopPreview() also kills the vite grandchild that
    // npx spawns (proc.kill() alone only stops npx and leaks the server).
    detached: true,
  })
  let exited = false
  proc.on('exit', () => (exited = true))
  for (let i = 0; i < 60 && !exited; i++) {
    try {
      const r = await fetch(url)
      if (r.ok && !exited) return { url, proc }
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  stopPreview(proc)
  throw new Error('vite preview did not start (did you run `npm run build`?)')
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

/**
 * Readability probe: freeze game time, list on-screen enemies, and save a 4x
 * close-up of the largest one as `<id>-enemy.png` (for eyeballing rim light and
 * contrast). Informational only — never fails the run.
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
      readable: list.filter((e) => e.px >= 12).length,
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

/**
 * Play: autofire for a few seconds, then killNearest(5) and screenshot the
 * explosions; then force results and screenshot.
 *
 * Autofire runs first so it has on-screen targets (some levels only have ~4 in
 * view, which killNearest(5) would wipe out). The kills come last because
 * explosions/popups fade after ~1-1.5 s of real time, which at ~1 fps is one or
 * two frames, so they are captured on the very next rendered frame.
 */
async function playLevel(page, id) {
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
  const nearestKilled = await page.evaluate(() => window.__SC_TEST__.killNearest(5))
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
  await page.screenshot({ path: path.join(OUT, `${id}-combat.png`), timeout: SHOT_TIMEOUT })
  const combat = await getStats(page)
  const weapon = await weaponProblems(page, 'desktop')
  problems.push(...weapon.problems)
  // Release the hold and let the trauma decay; it must return exactly to 0.
  await page.evaluate(() => { window.__SC_TEST__.holdFeedback = false })
  const settleStart = await getFrames(page)
  const settleDeadline = Date.now() + 30000
  const readShake = () => page.evaluate(() => {
    const s = window.__SC_TEST__
    return { frames: s.frames, ...s.cameraShake, trauma: s.cameraTrauma.current, traumaMax: s.cameraTrauma.max }
  })
  let shake = await readShake()
  while (Date.now() < settleDeadline) {
    await page.waitForTimeout(250)
    const now = await readShake()
    shake = now
    if (now.frames - settleStart >= 5 && now.current === 0 && now.trauma === 0) break
  }
  const counts = await page.evaluate(() => window.__SC_TEST__.combat)

  await page.evaluate(() => window.__SC_TEST__.endLevel())
  // App uses AnimatePresence mode="wait": the HUD fades out before the results fade in.
  const resultsShown = await page
    .waitForFunction(
      () => {
        const el = document.querySelector('.results-screen')
        if (!el) return false
        for (let n = el; n; n = n.parentElement) if (Number(getComputedStyle(n).opacity) < 0.98) return false
        return true
      },
      null,
      { timeout: 30000, polling: 250 },
    )
    .then(() => true, () => false)
  await page.screenshot({ path: path.join(OUT, `${id}-results.png`), timeout: SHOT_TIMEOUT })
  const end = await getStats(page)

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
      shakeMax: shake.max,
      shakeIdle: shake.current,
      traumaMaxDeg: shake.traumaMax,
      weapon: weapon.box,
      events: counts,
      // Set (to the phase) when the level timed out before the kill event could land.
      killCheckSkipped,
    },
    kills: combat.kills,
    score: combat.score,
  }
}

const MOBILE_LEVEL = 'level1'
/** HUD the first-person weapon must stay clear of (#65). */
const WEAPON_HUD_SELECTORS = '.hud-panel, .hud-combo, .hud-pause-button, .mute-button'
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
 * viewport, anchored in the lower-right, and never covering the screen centre
 * (where the crosshair usually is).
 */
async function weaponProblems(page, label) {
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
  // The projected bounding box is conservative (larger than the silhouette).
  for (const r of hud)
    if (box.minX < r.x + r.w && r.x < box.maxX && box.minY < r.y + r.h && r.y < box.maxY)
      problems.push(`${label}: weapon overlaps HUD .${String(r.sel).split(' ')[0]}`)
  box.hudOverlaps = problems.filter((p) => p.includes('overlaps HUD')).length
  return { problems, box }
}

/** HUD layout problems: elements missing, outside the viewport, or overlapping each other. */
async function hudLayoutProblems(page, label) {
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
  }, HUD_SELECTORS)
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

/** Touch playtest on a phone-sized viewport: real taps through the whole flow. */
async function runMobile(browser, base) {
  const started = Date.now()
  const { defaultBrowserType: _unused, ...iphone } = devices['iPhone 13']
  // Full-screen 390x844 portrait (the descriptor's 664 px viewport assumes Safari's
  // toolbars); DPR 2 instead of 3 keeps software rendering tolerable.
  const ctx = await browser.newContext({ ...iphone, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error' && !ignored(m.text())) errors.push(`console: ${m.text()}`)
  })
  const problems = []
  const phase = () => page.evaluate(() => window.__SC_TEST__.phase())
  const waitPhase = (p, timeout) =>
    page.waitForFunction((want) => window.__SC_TEST__.phase() === want, p, { timeout }).catch(() => {})
  await page.goto(`${base}/?e2e=1`, { waitUntil: 'load' })
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
  await page.locator(card).tap({ timeout: 30000 }).catch((e) => problems.push(`tap level: ${e.message}`))
  await waitPhase('playing', 15000)
  if ((await phase()) !== 'playing') problems.push('tapping the level card did not start the level')

  // Countdown (3 s) -> HUD; then wait for enemies on screen.
  if (!(await waitVisible(page, '.hud-pause-button', 40000))) problems.push('HUD never appeared')
  const enemyDeadline = Date.now() + Math.max(SECONDS, 10) * 2000
  while (Date.now() < enemyDeadline && (await getStats(page)).onScreenEnemies === 0) await page.waitForTimeout(500)

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
  const weaponLandscape = await weaponProblems(page, 'landscape 844x390')
  problems.push(...weaponLandscape.problems)
  await page.evaluate(() => { window.__SC_TEST__.holdFeedback = false })

  // Pause is a button (touch has no Escape key).
  if ((await phase()) !== 'playing') problems.push(`level left 'playing' (${await phase()}) before the pause tap`)
  await page.locator('.hud-pause-button').tap({ timeout: 30000 }).catch((e) => problems.push(`tap pause: ${e.message}`))
  await waitPhase('paused', 15000)
  if ((await phase()) !== 'paused') problems.push('tapping Pause did not pause')

  // Rotate back to portrait: the camera must follow again.
  await page.setViewportSize({ width: 390, height: 844 })
  await waitFrames(page, 2, { minMs: 500, maxMs: 8000 })
  const backAspect = await aspectProblems(page, 'portrait 390x844 (rotated back)')
  problems.push(...backAspect.problems)

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
      views: { portrait: portraitAspect.view, landscape: landscapeAspect.view, portraitAgain: backAspect.view },
    },
    kills: end.kills,
    score: end.score,
    hud: { portrait: portrait.rects, landscape: landscape.rects },
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

  const newPage = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    page.on('console', (m) => {
      if (m.type() === 'error' && !ignored(m.text())) errors.push(`console: ${m.text()}`)
    })
    await page.goto(`${base}/?e2e=1`, { waitUntil: 'load' })
    await page.waitForFunction(() => !!window.__SC_TEST__, null, { timeout: 30000 })
    return { ctx, page, errors }
  }

  // 1. Title screen
  const t = await newPage()
  const levels = await t.page.evaluate(() => window.__SC_TEST__.levels())
  // Wait until the title has rendered MIN_FRAMES (or a deadline passes). A fixed
  // short wait false-fails under slow software rendering (~1 fps on 2-core SwiftShader).
  const f0 = await t.page.evaluate(() => window.__SC_TEST__.frames)
  const titleDeadline = Date.now() + Math.max(4, SECONDS) * 1000
  let f1 = f0
  while (Date.now() < titleDeadline) {
    await t.page.waitForTimeout(500)
    f1 = await t.page.evaluate(() => window.__SC_TEST__.frames)
    if (f1 - f0 >= MIN_FRAMES) break
  }
  const titlePng = await t.page.screenshot({ path: path.join(OUT, 'title.png'), timeout: SHOT_TIMEOUT })
  const titleImg = await imageStats(t.page, titlePng)
  const titleOk = f1 - f0 >= MIN_FRAMES && t.errors.length === 0 && titleImg.stddev > 4
  failed ||= !titleOk
  results.push({ id: 'title', ok: titleOk, frames: f1 - f0, image: titleImg, errors: t.errors })
  await t.ctx.close()

  // 2. Every level (or the requested subset)
  const wanted = args['skip-desktop'] ? [] : args.levels ? args.levels.split(',') : levels.map((l) => l.id)
  for (const id of wanted) {
    const { ctx, page, errors } = await newPage()
    const started = Date.now()
    await page.evaluate((lid) => window.__SC_TEST__.startLevel(lid), id)
    const a = await page.evaluate(() => window.__SC_TEST__.frames)
    await page.waitForTimeout(SECONDS * 1000)
    const stats = await page.evaluate(() => {
      const s = window.__SC_TEST__
      return { frames: s.frames, avgFrameMs: s.avgFrameMs, drawCalls: s.drawCalls, triangles: s.triangles, phase: s.phase(), hookErrors: s.errors, scene: s.sceneStats?.() ?? null }
    })
    const png = await page.screenshot({ path: path.join(OUT, `${id}.png`), timeout: SHOT_TIMEOUT })
    const img = await imageStats(page, png)
    const enemyShot = await captureEnemyCloseup(page, id)
    const frames = stats.frames - a
    const problems = []

    if (frames < MIN_FRAMES) problems.push(`render loop stalled (${frames} frames in ${SECONDS}s)`)
    if (img.stddev < 4 || img.distinctColors < 8) problems.push('frame looks blank')
    if (stats.phase !== 'playing') problems.push(`unexpected phase "${stats.phase}" after ride`)
    const desktopAspect = await aspectProblems(page, 'desktop 1280x720')
    problems.push(...desktopAspect.problems)
    stats.view = desktopAspect.view
    const play = await playLevel(page, id)
    problems.push(...play.problems)
    const hookErrors = await page.evaluate(() => window.__SC_TEST__.errors)
    const allErrors = [...errors, ...hookErrors]
    if (allErrors.length) problems.push(`${allErrors.length} error(s)`)
    const ok = problems.length === 0
    failed ||= !ok
    delete stats.hookErrors
    results.push({
      id, ok, problems, frames, seconds: (Date.now() - started) / 1000, ...stats,
      kills: play.kills, score: play.score, combat: play.combat, image: img, enemies: enemyShot, errors: allErrors,
    })
    await ctx.close()
  }

  // 3. Optional touch playtest on a phone viewport
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
      ? ''
      : r.mobile
        ? ` taps=${r.mobile.taps} (on enemies ${r.mobile.tapsOnEnemies}) tapShots=${r.mobile.tapShots}` +
          ` tapKills=${r.mobile.tapKills} landscapeTapKills=${r.mobile.landscapeTaps?.tapKills ?? '-'}` +
          ` fallbackKills=${r.mobile.fallbackKills} kills=${r.kills} score=${r.score}${viewSummary(r.mobile.views)} ${r.seconds.toFixed(0)}s`
      : ` draws=${r.drawCalls} tris=${r.triangles} avgFrameMs=${r.avgFrameMs?.toFixed(1)}${sceneSummary(r.scene)}${en}` +
        ` kills=${r.kills} (autofire ${r.combat.autofireKills}, shots ${r.combat.shotsFired}, mouse shots ${r.combat.mouseShots}) score=${r.score}` +
        ` shakeMax=${r.combat.shakeMax?.toFixed(2)} traumaMax=${r.combat.traumaMaxDeg?.toFixed(2)}°${r.combat.killCheckSkipped ? ' killEvent=skipped(level timed out)' : ''} ${r.seconds.toFixed(0)}s`
    console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.id.padEnd(10)}${r.frames === undefined ? '' : ` frames=${r.frames}`}${extra}${r.problems?.length ? ' — ' + r.problems.join('; ') : ''}`)
    for (const e of r.errors.slice(0, 5)) console.log(`     ${e}`)
  }
  console.log(`Screenshots + results.json in ${OUT} (total ${((Date.now() - runStarted) / 1000).toFixed(0)}s)`)
  process.exit(failed ? 1 : 0)
}

/** Camera vs canvas aspect + FOV per mobile orientation, for the summary line. */
function viewSummary(views) {
  if (!views) return ''
  const f = (v) => (v ? `${v.cameraAspect?.toFixed(2)}/${v.canvasAspect.toFixed(2)} fov ${v.fov?.toFixed(0)}x${v.hFov?.toFixed(0)}` : '-')
  return ` aspect cam/canvas portrait=${f(views.portrait)} landscape=${f(views.landscape)} back=${f(views.portraitAgain)}`
}

/** Camera-independent totals: whole scene, and objects whose name starts with "track". */
function sceneSummary(scene) {
  if (!scene) return ''
  let objs = 0, tris = 0
  for (const [name, e] of Object.entries(scene.byName)) {
    if (name.startsWith('track')) { objs += e.objects; tris += e.triangles }
  }
  return ` | scene objs=${scene.objects} tris=${scene.triangles} (track objs=${objs} tris=${tris})`
}

run().catch((e) => {
  console.error(e)
  if (preview) stopPreview(preview.proc) // don't leak the vite preview server on failure
  process.exit(1)
})
