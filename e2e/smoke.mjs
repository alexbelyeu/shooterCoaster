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
 * produced a kill event, camera shake exceeded 3 units or did not return exactly
 * to the track, or the results screen never appears.
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
 * taps level 1, taps the canvas 10x at on-screen enemies through real touch
 * input, and requires the taps to fire and a kill to happen (killNearest(3) is
 * the fallback when no tapped bullet connects at ~1 fps; reported as
 * tapKills). Checks HUD elements are inside the viewport and don't overlap in
 * portrait and in 844x390 landscape, then taps Pause. Saves
 * mobile-level1.png and mobile-level1-landscape.png.
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

async function startPreview() {
  const port = 4173 + Math.floor(Math.random() * 500)
  const proc = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    // Own process group, so stopPreview() also kills the vite grandchild that
    // npx spawns (proc.kill() alone only stops npx and leaks the server).
    detached: true,
  })
  const url = `http://localhost:${port}`
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(url)
      if (r.ok) return { url, proc }
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  stopPreview({ proc })
  throw new Error('vite preview did not start (did you run `npm run build`?)')
}

function stopPreview(p) {
  if (!p?.proc?.pid) return
  try {
    process.kill(-p.proc.pid, 'SIGTERM')
  } catch {
    p.proc.kill()
  }
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
  // Release the hold and let the shake decay; it must return exactly to 0.
  await page.evaluate(() => { window.__SC_TEST__.holdFeedback = false })
  const settleStart = await getFrames(page)
  const settleDeadline = Date.now() + 30000
  let shake = await page.evaluate(() => window.__SC_TEST__.cameraShake)
  while (Date.now() < settleDeadline) {
    await page.waitForTimeout(250)
    const now = await page.evaluate(() => ({ frames: window.__SC_TEST__.frames, ...window.__SC_TEST__.cameraShake }))
    shake = now
    if (now.frames - settleStart >= 5 && now.current === 0) break
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
  if (shake.max > 3 + 1e-6) problems.push(`camera shake ${shake.max.toFixed(2)} > 3 units`)
  if (shake.current !== 0) problems.push(`camera shake did not reset (${shake.current})`)
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
      events: counts,
      // Set (to the phase) when the level timed out before the kill event could land.
      killCheckSkipped,
    },
    kills: combat.kills,
    score: combat.score,
  }
}

const MOBILE_LEVEL = 'level1'
const HUD_SELECTORS = ['.hud-score', '.hud-enemies', '.hud-timer', '.hud-combo', '.hud-pause-button', '.mute-button']

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

  // 10 taps on the canvas, each at the nearest on-screen enemy (centre if none).
  const before = await getStats(page)
  let tapsOnEnemies = 0
  const vp = page.viewportSize()
  for (let i = 0; i < 10; i++) {
    const [pt] = await page.evaluate(() => window.__SC_TEST__.enemyScreenPoints(1))
    if (pt) tapsOnEnemies++
    // Keep taps off the HUD buttons in the bottom corners.
    const x = Math.min(Math.max(pt?.x ?? vp.width / 2, 8), vp.width - 8)
    const y = Math.min(Math.max(pt?.y ?? vp.height / 2, 8), vp.height - 80)
    await page.touchscreen.tap(x, y)
    await waitFrames(page, 1, { minMs: 80, maxMs: 4000, pollMs: 40 })
  }
  const afterTaps = await getStats(page)
  const tapShots = afterTaps.shotsFired - before.shotsFired
  if (tapShots === 0) problems.push('10 taps fired no shots (touch input broken?)')
  const crosshairScale = await page.evaluate(() => {
    const el = document.querySelector('.crosshair-svg')
    return el ? new DOMMatrixReadOnly(getComputedStyle(el).transform).a : 0
  })
  if (Math.abs(crosshairScale - 1.25) > 0.01) problems.push(`crosshair not in touch mode (scale ${crosshairScale})`)

  // Give tapped bullets a few frames to connect, then fall back to killNearest(3)
  // (3 so the screenshot also shows the combo counter in its phone position).
  const killDeadline = Date.now() + 15000
  let s = afterTaps
  while (Date.now() < killDeadline && s.kills === before.kills) {
    await waitFrames(page, 1, { maxMs: 4000, pollMs: 100 })
    s = await getStats(page)
  }
  const tapKills = s.kills - before.kills
  let fallbackKills = 0
  if (tapKills === 0) {
    fallbackKills = await page.evaluate(() => window.__SC_TEST__.killNearest(3))
    await waitFrames(page, 1, { maxMs: 5000, pollMs: 30 })
  }
  // The level timer runs on wall-clock time, so on a slow runner the level can
  // time out (HUD unmounts) before the layout + pause checks. Freeze game time
  // now that the touch-input checks are done; pause still works while frozen.
  if ((await phase()) !== 'playing') problems.push(`level left 'playing' (${await phase()}) before the HUD layout checks`)
  await page.evaluate(() => window.__SC_TEST__.setTimeScale(0))
  await page.screenshot({ path: path.join(OUT, `mobile-${MOBILE_LEVEL}.png`), timeout: SHOT_TIMEOUT })
  const end = await getStats(page)
  if (end.kills === 0 && end.score <= 0) problems.push('no kill reached')

  const portrait = await hudLayoutProblems(page, 'portrait 390x844')
  problems.push(...portrait.problems)

  await page.setViewportSize({ width: 844, height: 390 })
  await waitFrames(page, 2, { minMs: 500, maxMs: 8000 })
  const landscape = await hudLayoutProblems(page, 'landscape 844x390')
  problems.push(...landscape.problems)
  await page.screenshot({ path: path.join(OUT, `mobile-${MOBILE_LEVEL}-landscape.png`), timeout: SHOT_TIMEOUT })

  // Pause is a button (touch has no Escape key).
  if ((await phase()) !== 'playing') problems.push(`level left 'playing' (${await phase()}) before the pause tap`)
  await page.locator('.hud-pause-button').tap({ timeout: 30000 }).catch((e) => problems.push(`tap pause: ${e.message}`))
  await waitPhase('paused', 15000)
  if ((await phase()) !== 'paused') problems.push('tapping Pause did not pause')

  const hookErrors = await page.evaluate(() => window.__SC_TEST__.errors)
  const allErrors = [...errors, ...hookErrors]
  if (allErrors.length) problems.push(`${allErrors.length} error(s)`)
  await ctx.close()
  return {
    id: `mobile-${MOBILE_LEVEL}`,
    ok: problems.length === 0,
    problems,
    seconds: (Date.now() - started) / 1000,
    mobile: { taps: 10, tapsOnEnemies, tapShots, tapKills, fallbackKills, crosshairScale },
    kills: end.kills,
    score: end.score,
    hud: { portrait: portrait.rects, landscape: landscape.rects },
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
    const frames = stats.frames - a
    const problems = []

    if (frames < MIN_FRAMES) problems.push(`render loop stalled (${frames} frames in ${SECONDS}s)`)
    if (img.stddev < 4 || img.distinctColors < 8) problems.push('frame looks blank')
    if (stats.phase !== 'playing') problems.push(`unexpected phase "${stats.phase}" after ride`)
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
      kills: play.kills, score: play.score, combat: play.combat, image: img, errors: allErrors,
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
  stopPreview(preview)

  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2))
  for (const r of results) {
    const extra = r.id === 'title'
      ? ''
      : r.mobile
        ? ` taps=${r.mobile.taps} (on enemies ${r.mobile.tapsOnEnemies}) tapShots=${r.mobile.tapShots}` +
          ` tapKills=${r.mobile.tapKills} fallbackKills=${r.mobile.fallbackKills} kills=${r.kills} score=${r.score} ${r.seconds.toFixed(0)}s`
      : ` draws=${r.drawCalls} tris=${r.triangles} avgFrameMs=${r.avgFrameMs?.toFixed(1)}${sceneSummary(r.scene)}` +
        ` kills=${r.kills} (autofire ${r.combat.autofireKills}, shots ${r.combat.shotsFired}, mouse shots ${r.combat.mouseShots}) score=${r.score}` +
        ` shakeMax=${r.combat.shakeMax?.toFixed(2)}${r.combat.killCheckSkipped ? ' killEvent=skipped(level timed out)' : ''} ${r.seconds.toFixed(0)}s`
    console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.id.padEnd(10)}${r.frames === undefined ? '' : ` frames=${r.frames}`}${extra}${r.problems?.length ? ' — ' + r.problems.join('; ') : ''}`)
    for (const e of r.errors.slice(0, 5)) console.log(`     ${e}`)
  }
  console.log(`Screenshots + results.json in ${OUT} (total ${((Date.now() - runStarted) / 1000).toFixed(0)}s)`)
  process.exit(failed ? 1 : 0)
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
  stopPreview(preview) // don't leak the vite preview server on failure
  process.exit(1)
})
