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
 * pointing along the shot's tracer (> 25° on screen), the
 * camera aspect doesn't match the canvas, or the results screen never finishes its
 * reveal, lacks a stats row or button, or shows NaN / a score or kills that disagree with stats().
 * Every level and the phone run (portrait, and after rotating) also run audioBurst():
 * fails on a late note that throws or a sound dropped by an audio error (#115).
 * Saves screenshots + stats to e2e-results/.
 *
 * Spawns use a fixed --seed (default 1337); the seed check reloads the first level
 * and requires the same spawnDigest() for that seed and a different one for another.
 * The hidden-pause check fakes a tab hide on the first level: it must pause, drop a
 * held trigger, keep the timer still, wait for Resume, then neither reset nor jump it.
 * `?e2e=1` skips the Ready / Set / GO countdown; the countdown check loads the first level
 * with `&countdown=1`: the countdown must show (countdown.png), ignore a press (also once
 * held on into play), hold the timer, reach playing on GO, and the shader warm-up must
 * finish; on a replay, a tap after the 1 s mark must skip to playing.
 * The speed check holds the first level at top speed on its most banked sampled point:
 * the wind streaks must show and the camera bank ≥ 1° (speed.png).
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
// SwiftShader on a shared 2-core box can take >30s (Playwright's default) to produce
// a frame for the heavier biomes; a slow screenshot is not a game bug.
const SHOT_TIMEOUT = Number(args['shot-timeout'] ?? 120000)
const COMBAT_SECONDS = Number(args['combat-seconds'] ?? 4)
const COMBAT_MIN_FRAMES = Number(args['combat-min-frames'] ?? 4)
// Fixed run seed (enemy spawns) so screenshots are comparable run to run.
const SEED = Number(args.seed ?? 1337)
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
      translationMax: shake.max,
      translationIdle: shake.current,
      traumaMaxDeg: shake.traumaMax,
      cameraWeight: w,
      weapon: weapon.box,
      events: counts,
      // Set (to the phase) when the level timed out before the kill event could land.
      killCheckSkipped,
      audioBurst: audio.burst,
    },
    kills: combat.kills,
    score: combat.score,
    results: results.screen,
  }
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
    return { rows, buttons, stars, score: el.querySelector('.results-score-value')?.textContent ?? '', text: el.textContent }
  })
  const problems = []
  if (!screen) return { problems: ['results screen missing'], screen }
  const { text, ...shown } = screen
  if (/NaN|undefined|Infinity/.test(text)) problems.push(`results screen shows NaN/undefined: "${text}"`)
  for (const label of ['Kills', 'Accuracy', 'Best combo', 'Time left']) {
    if (!(label in screen.rows)) problems.push(`results screen has no "${label}" row`)
  }
  if (screen.rows.Kills && !screen.rows.Kills.startsWith(`${stats.kills} /`)) problems.push(`results kills "${screen.rows.Kills}" != ${stats.kills}`)
  if (stats.shotsFired > 0 && !/^\d+%$/.test(screen.rows.Accuracy ?? '')) problems.push(`results accuracy "${screen.rows.Accuracy}" with ${stats.shotsFired} shots`)
  if (!screen.buttons.includes('Replay') || !screen.buttons.includes('Levels')) problems.push(`results buttons ${JSON.stringify(screen.buttons)}`)
  if (screen.score.replace(/,/g, '') !== String(stats.score)) problems.push(`results score "${screen.score}" != ${stats.score}`)
  return { problems, screen: shown }
}

const MOBILE_LEVEL = 'level1'
/** HUD the first-person weapon must stay clear of (#65). */
const WEAPON_HUD_SELECTORS = '.hud-panel, .hud-combo, .hud-pause-button, .mute-button'
/** Max angle between the barrel and the tracer on screen (#65). */
const WEAPON_MAX_AIM_DEG = 25
/** Caps on the coaster camera weight (#123): MAX_BANK_DEG / MAX_PITCH_DEG in
 *  src/track/cameraRig.ts and SPEED_FOV_DEG + DROP_FOV_DEG in src/track/cameraFov.ts. */
const CAMERA_WEIGHT_CAPS = { roll: 8, pitch: 3, fovKick: 8 }
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
 * (where the crosshair usually is), and pointing along the last shot's tracer.
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
  // The shot must read as leaving the barrel: on the held frame, the tracer
  // (tip → last shot) runs within WEAPON_MAX_AIM_DEG of the barrel (pivot → tip)
  // for any aim point above the muzzle and not right on top of it.
  const barrel = Math.atan2(box.tipY - box.pivotY, box.tipX - box.pivotX)
  const shot = Math.atan2(box.shotY - box.tipY, box.shotX - box.tipX)
  box.aimErrorDeg = Math.abs(((shot - barrel + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) * (180 / Math.PI)
  const shotFar = Math.hypot(box.shotX - box.tipX, box.shotY - box.tipY) > 0.1 * Math.min(vw, vh)
  if (box.shotY < box.tipY && shotFar && box.aimErrorDeg > WEAPON_MAX_AIM_DEG)
    problems.push(`${label}: tracer leaves the barrel ${box.aimErrorDeg.toFixed(0)}° off its direction (> ${WEAPON_MAX_AIM_DEG}°)`)
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

/** Leaving the tab pauses the run and drops the trigger; nothing drains or resets the timer (#118). */
async function hiddenPauseCheck(page, levelId) {
  await page.evaluate(([lid, seed]) => window.__SC_TEST__.startLevel(lid, seed), [levelId, SEED])
  await waitFrames(page, 3, { minMs: 3000, maxMs: 30000 })
  const vp = page.viewportSize()
  await page.mouse.move(vp.width / 2, vp.height / 2)
  await page.mouse.down()
  const heldBefore = await page.evaluate(() => window.__SC_TEST__.triggerHeld())
  const before = await setHidden(page, true)
  const heldAfter = await page.evaluate(() => window.__SC_TEST__.triggerHeld())
  await page.mouse.up()
  const hiddenPhase = await page.evaluate(() => window.__SC_TEST__.phase())
  await waitFrames(page, 3, { minMs: 5000, maxMs: 30000 })
  const whileHidden = await getStats(page)
  await setHidden(page, false)
  await waitFrames(page, 2, { maxMs: 10000 })
  const shownPhase = await page.evaluate(() => window.__SC_TEST__.phase())
  const resumedAt = Date.now()
  const resumeClicked = await page
    .getByRole('button', { name: 'Resume' })
    .click({ timeout: 30000 })
    .then(() => true, () => false)
  await waitFrames(page, 3, { minMs: 3000, maxMs: 30000 })
  const resumed = await getStats(page)
  const resumedSeconds = (Date.now() - resumedAt) / 1000
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  const blurPhase = await page.evaluate(() => window.__SC_TEST__.phase())

  const problems = []
  if (before.phase !== 'playing') problems.push(`level not playing before hiding ("${before.phase}")`)
  if (!heldBefore) problems.push('mouse down did not hold the trigger')
  if (heldAfter) problems.push('trigger still held after the tab was hidden')
  if (hiddenPhase !== 'paused') problems.push(`hiding the tab left the phase "${hiddenPhase}", not paused`)
  if (whileHidden.timeRemaining !== before.timeRemaining)
    problems.push(`timer moved while hidden (${before.timeRemaining.toFixed(2)} -> ${whileHidden.timeRemaining.toFixed(2)})`)
  if (shownPhase !== 'paused') problems.push(`showing the tab again auto-resumed (phase "${shownPhase}")`)
  if (!resumeClicked) problems.push('Resume button not clickable')
  if (resumed.phase !== 'playing') problems.push(`Resume left the phase "${resumed.phase}"`)
  if (resumed.timeRemaining > before.timeRemaining)
    problems.push(`timer reset on resume (${before.timeRemaining.toFixed(2)} -> ${resumed.timeRemaining.toFixed(2)})`)
  // timeRemaining is only stored on whole-second crossings, hence the 1 s slack.
  if (resumed.timeRemaining < before.timeRemaining - resumedSeconds - 1)
    problems.push(`timer jumped by the paused time (${before.timeRemaining.toFixed(2)} -> ${resumed.timeRemaining.toFixed(2)} after ${resumedSeconds.toFixed(1)} s of play)`)
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
      heldBefore,
      heldAfter,
    },
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
  if (layout.cards !== levels.length) problems.push(`${layout.cards} level cards for ${levels.length} levels`)
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

/**
 * Title fly-by (#28): `title-2.png` 6 s after `title.png` shows another camera angle; the start hint
 * shows; a key press fades to black and opens level select.
 */
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
  return { problems, result: { turnedDeg, moved, waited, hint, veiled, opened } }
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

/**
 * Title -> level music (#28): the title track ramps out from full and is disposed, the level track
 * ramps in from silence, and no music bus is cut without a ramp. Reads the ramp log, because at
 * ~1 fps a 1 s fade can start and end between two polls.
 */
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
      audio: { portrait: audioPortrait, landscape: audioLandscape, music: music.result },
      audioBurst: { portrait: burstPortrait.burst, landscape: burstLandscape.burst },
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

  const newPage = async (query = 'e2e=1') => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    page.on('console', (m) => {
      if (m.type() === 'error' && !ignored(m.text())) errors.push(`console: ${m.text()}`)
    })
    await page.goto(`${base}/?${query}`, { waitUntil: 'load' })
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
  const fly = await titleFlyBy(t.page)
  const titleProblems = [...fly.problems]
  if (f1 - f0 < MIN_FRAMES) titleProblems.push(`only ${f1 - f0} frames`)
  if (titleImg.stddev <= 4) titleProblems.push('title.png is blank')
  if (t.errors.length) titleProblems.push(`${t.errors.length} error(s)`)
  const titleOk = titleProblems.length === 0
  failed ||= !titleOk
  results.push({ id: 'title', ok: titleOk, problems: titleProblems, frames: f1 - f0, image: titleImg, title: fly.result, errors: t.errors })
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

  // 2. Every level (or the requested subset)
  const wanted = args['skip-desktop'] ? [] : args.levels ? args.levels.split(',') : levels.map((l) => l.id)
  for (const id of wanted) {
    const { ctx, page, errors } = await newPage()
    const started = Date.now()
    await page.evaluate(([lid, seed]) => window.__SC_TEST__.startLevel(lid, seed), [id, SEED])
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
    const spawnDigest = await nextSpawnDigest(page, null)
    if (!spawnDigest) problems.push('spawnDigest() never reported the spawns')

    if (frames < MIN_FRAMES) problems.push(`render loop stalled (${frames} frames in ${SECONDS}s)`)
    if (img.stddev < 4 || img.distinctColors < 8) problems.push('frame looks blank')
    if (stats.phase !== 'playing') problems.push(`unexpected phase "${stats.phase}" after ride`)
    if (stats.scene && !stats.scene.environment) problems.push('no scene.environment (sky env map not baked)')
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
      id, ok, problems, frames, seconds: (Date.now() - started) / 1000, spawnDigest, ...stats,
      kills: play.kills, score: play.score, combat: play.combat, results: play.results, image: img, enemies: enemyShot, errors: allErrors,
    })
    await ctx.close()
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
      : r.levelSelect
        ? ` cards=${r.levelSelect.cards} locked=${r.levelSelect.locked} stars=${r.levelSelect.total}` +
          (r.levelSelect.keyboard ? ` keys: ${r.levelSelect.focused} <- ${r.levelSelect.keyboard.left}, locked ${r.levelSelect.keyboard.locked} Enter -> ${r.levelSelect.keyboard.phaseAfterLocked}, Enter -> ${r.levelSelect.keyboard.level} ${r.levelSelect.keyboard.phase}` : '')
      : r.seedCheck
        ? ` ${r.seedCheck.level} seed ${SEED}: ${r.seedCheck.digest} (reload ${r.seedCheck.reloaded}, again ${r.seedCheck.again}) seed ${SEED + 1}: ${r.seedCheck.other}`
      : r.hiddenPause
        ? ` ${r.hiddenPause.level} timer ${r.hiddenPause.before.toFixed(1)} -> after 5s hidden ${r.hiddenPause.whileHidden.toFixed(1)}` +
          ` -> ${r.hiddenPause.resumed.toFixed(1)} after ${r.hiddenPause.resumedSeconds.toFixed(0)}s resumed, trigger held ${r.hiddenPause.heldBefore}->${r.hiddenPause.heldAfter}`
      : r.countdown
        ? ` ${r.countdown.level} "${r.countdown.stepText}" timer ${r.countdown.timerDuring.toFixed(1)} -> ${r.countdown.timerAtGo.toFixed(1)} at GO,` +
          ` held into play: ${r.countdown.shotsHeldIntoPlay} shots, replay tap in ${r.countdown.skipTapIn},` +
          ` shader warm-up ${r.countdown.warmup?.done ? `${r.countdown.warmup.ms.toFixed(0)} ms, ${r.countdown.warmup.programs} programs` : 'unfinished'},` +
          ` first shot: programs ${r.countdown.firstShot.programs} -> ${r.countdown.firstShot.programsAfter}, longest frame ${r.countdown.firstShot.maxFrameMs.toFixed(0)} ms (avg ${r.countdown.firstShot.avgFrameMs.toFixed(0)})`
      : r.speed
        ? ` ${r.speed.level} at track ${r.speed.fraction}: speed ${r.speed.speed.toFixed(2)} streaks ${r.speed.streaks.toFixed(2)} ${weightSummary(r.speed)}`
      : r.mobile
        ? ` taps=${r.mobile.taps} (on enemies ${r.mobile.tapsOnEnemies}) tapShots=${r.mobile.tapShots}` +
          ` tapKills=${r.mobile.tapKills} landscapeTapKills=${r.mobile.landscapeTaps?.tapKills ?? '-'}` +
          ` fallbackKills=${r.mobile.fallbackKills} sfxNodes=${audioSummary(r.mobile.audio)} audioBurst=${burstSummary(r.mobile.audioBurst.portrait)}/${burstSummary(r.mobile.audioBurst.landscape)} gunAimErr=${r.weapon?.portrait?.aimErrorDeg?.toFixed(0)}°/${r.weapon?.landscape?.aimErrorDeg?.toFixed(0)}° kills=${r.kills} score=${r.score}${viewSummary(r.mobile.views)} ${r.seconds.toFixed(0)}s`
      : ` draws=${r.drawCalls} tris=${r.triangles} avgFrameMs=${r.avgFrameMs?.toFixed(1)}${sceneSummary(r.scene)}${en}` +
        ` kills=${r.kills} (autofire ${r.combat.autofireKills}, shots ${r.combat.shotsFired}, mouse shots ${r.combat.mouseShots}) score=${r.score}` +
        ` audioBurst=${burstSummary(r.combat.audioBurst)} translationMax=${r.combat.translationMax?.toFixed(2)} traumaMax=${r.combat.traumaMaxDeg?.toFixed(2)}° weight=${weightSummary(r.combat.cameraWeight)} gunAimErr=${r.combat.weapon?.aimErrorDeg?.toFixed(0)}°${resultsSummary(r.results)}${r.combat.killCheckSkipped ? ' killEvent=skipped(level timed out)' : ''} ${r.seconds.toFixed(0)}s`
    console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.id.padEnd(10)}${r.frames === undefined ? '' : ` frames=${r.frames}`}${extra}${r.problems?.length ? ' — ' + r.problems.join('; ') : ''}`)
    for (const e of r.errors.slice(0, 5)) console.log(`     ${e}`)
  }
  console.log(`Screenshots + results.json in ${OUT} (total ${((Date.now() - runStarted) / 1000).toFixed(0)}s)`)
  process.exit(failed ? 1 : 0)
}

function resultsSummary(s) {
  return s ? ` results=${s.stars}★ acc=${s.rows.Accuracy} combo=${s.rows['Best combo']}` : ''
}

/** audioBurst result: "ok", or late-note throws + dropped sounds. */
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

/** Camera-independent totals: whole scene, and objects whose name starts with "track". */
function sceneSummary(scene) {
  if (!scene) return ''
  let objs = 0, tris = 0
  for (const [name, e] of Object.entries(scene.byName)) {
    if (name.startsWith('track')) { objs += e.objects; tris += e.triangles }
  }
  const env = scene.environment
  const envText = env ? ` env=${env.intensity} bake=${env.bakeMs?.toFixed(1)}ms` : ' env=none'
  return ` | scene objs=${scene.objects} tris=${scene.triangles} (track objs=${objs} tris=${tris})${envText}`
}

run().catch((e) => {
  console.error(e)
  if (preview) stopPreview(preview.proc) // don't leak the vite preview server on failure
  process.exit(1)
})
