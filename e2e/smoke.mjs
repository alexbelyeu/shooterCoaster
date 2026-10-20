#!/usr/bin/env node
/**
 * ShooterCoaster smoke test / headless playtest.
 *
 * Boots the built game (vite preview) in headless Chromium, checks the title
 * screen renders, then loads EVERY registered level via the ?e2e=1 test hook and
 * verifies: no uncaught errors, the render loop advances, and the frame is not
 * blank. Saves a screenshot + stats per level to e2e-results/.
 *
 * Usage:
 *   npm run build && node e2e/smoke.mjs                 # all levels
 *   node e2e/smoke.mjs --levels level1,level5 --seconds 12
 *   node e2e/smoke.mjs --url https://example.com        # test a deployed site
 *
 * Browser: uses Playwright's bundled Chromium if installed; otherwise set
 * SC_CHROME=/path/to/chromium (see scripts/ensure-browser.sh for cloud sessions).
 */
import { chromium } from 'playwright'
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
    await page.waitForFunction((f0) => window.__SC_TEST__.frames >= f0 + 2, f, { timeout: 15000 })
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
      const crop = await page.screenshot({ clip: { x, y, width: 2 * half, height: 2 * half } })
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
    await page.evaluate(() => window.__SC_TEST__.setTimeScale(1))
    return summary
  } catch (e) {
    return { error: String(e?.message ?? e).split('\n')[0] }
  }
}

let preview
async function run() {
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
  const titlePng = await t.page.screenshot({ path: path.join(OUT, 'title.png') })
  const titleImg = await imageStats(t.page, titlePng)
  const titleOk = f1 - f0 >= MIN_FRAMES && t.errors.length === 0 && titleImg.stddev > 4
  failed ||= !titleOk
  results.push({ id: 'title', ok: titleOk, frames: f1 - f0, image: titleImg, errors: t.errors })
  await t.ctx.close()

  // 2. Every level (or the requested subset)
  const wanted = args.levels ? args.levels.split(',') : levels.map((l) => l.id)
  for (const id of wanted) {
    const { ctx, page, errors } = await newPage()
    const started = Date.now()
    await page.evaluate((lid) => window.__SC_TEST__.startLevel(lid), id)
    const a = await page.evaluate(() => window.__SC_TEST__.frames)
    await page.waitForTimeout(SECONDS * 1000)
    const stats = await page.evaluate(() => {
      const s = window.__SC_TEST__
      return { frames: s.frames, avgFrameMs: s.avgFrameMs, drawCalls: s.drawCalls, triangles: s.triangles, phase: s.phase(), hookErrors: s.errors }
    })
    const png = await page.screenshot({ path: path.join(OUT, `${id}.png`) })
    const img = await imageStats(page, png)
    const enemyShot = await captureEnemyCloseup(page, id)
    const allErrors = [...errors, ...stats.hookErrors]
    const frames = stats.frames - a
    const problems = []
    if (frames < MIN_FRAMES) problems.push(`render loop stalled (${frames} frames in ${SECONDS}s)`)
    if (allErrors.length) problems.push(`${allErrors.length} error(s)`)
    if (img.stddev < 4 || img.distinctColors < 8) problems.push('frame looks blank')
    if (!['playing', 'results'].includes(stats.phase)) problems.push(`unexpected phase "${stats.phase}"`)
    const ok = problems.length === 0
    failed ||= !ok
    results.push({ id, ok, problems, frames, seconds: (Date.now() - started) / 1000, ...stats, image: img, enemies: enemyShot, errors: allErrors })
    await ctx.close()
  }

  await browser.close()
  if (preview) stopPreview(preview.proc)

  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2))
  for (const r of results) {
    const en = r.enemies && !r.enemies.error
      ? ` enemiesOnScreen=${r.enemies.onScreen} readable=${r.enemies.readable} largestPx=${r.enemies.largestPx}`
      : ''
    const extra = r.id === 'title' ? '' : ` draws=${r.drawCalls} tris=${r.triangles} avgFrameMs=${r.avgFrameMs?.toFixed(1)}${en}`
    console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.id.padEnd(10)} frames=${r.frames}${extra}${r.problems?.length ? ' — ' + r.problems.join('; ') : ''}`)
    for (const e of r.errors.slice(0, 5)) console.log(`     ${e}`)
  }
  console.log(`Screenshots + results.json in ${OUT}`)
  process.exit(failed ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  if (preview) stopPreview(preview.proc)
  process.exit(1)
})
