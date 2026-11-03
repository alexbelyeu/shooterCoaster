#!/usr/bin/env node
/**
 * Deploy health check (#352): did this deploy arrive intact? Checks `assets`, `routes`, `title`, `level`, `phone`
 * (what each covers: e2e/README.md "Production") and rewrites `prod-check.json` after each, for scripts/prod-alert.cjs.
 *   npm run build && node e2e/prod-check.mjs --url https://scoaster.com
 *   npm run build && node e2e/prod-check.mjs     # serves dist/ on localhost the way vercel.json says
 */
import { devices } from 'playwright'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { launchBrowser } from '../scripts/headless.mjs'
import { assetRefs, missingAssets, responseProblems } from '../scripts/prodCheckRules.mjs'
import { headersFor, route } from '../scripts/vercelRoutes.mjs'
import { TITLE_UI, ignored, imageStats, looksBlank, waitFrames, waitVisible } from './pageChecks.mjs'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]?.startsWith('--') ? 'true' : arr[i + 1] ?? 'true'])
    return acc
  }, []),
)
const DIST = path.resolve(args.dist ?? 'dist')
const OUT = path.resolve(args.out ?? 'e2e-results')
const LEVEL = args.level ?? 'level1'
const SEED = Number(args.seed ?? 1337)
const SHOT_TIMEOUT = 120000
const vercel = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
fs.mkdirSync(OUT, { recursive: true })

const report = { url: null, startedAt: new Date().toISOString(), running: null, finished: false, checks: [] }
const save = () => fs.writeFileSync(path.join(OUT, 'prod-check.json'), JSON.stringify(report, null, 2))

/** A throw is a failed check, not a crash. */
async function check(id, fn) {
  report.running = id
  save()
  const started = Date.now()
  let problems
  let info = {}
  try {
    ;({ problems, ...info } = await fn())
  } catch (e) {
    problems = [`threw: ${e.message.split('\n')[0]}`]
  }
  const seconds = (Date.now() - started) / 1000
  report.checks.push({ id, ok: problems.length === 0, problems, seconds, ...info })
  report.running = null
  save()
  console.log(`${problems.length ? 'FAIL' : 'PASS'} ${id.padEnd(7)} ${seconds.toFixed(0)}s${info.summary ? ` ${info.summary}` : ''}${problems.length ? ` — ${problems.slice(0, 8).join('; ')}` : ''}`)
}

function distFiles() {
  return fs
    .readdirSync(DIST, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => '/' + path.relative(DIST, path.join(d.parentPath, d.name)).split(path.sep).join('/'))
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain', '.xml': 'application/xml' }

function serveDist() {
  const files = new Set(distFiles())
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    const { status, serves } = route(pathname, files, vercel)
    res.writeHead(status, {
      'Content-Type': MIME[path.extname(serves)] ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      ...headersFor(pathname, vercel),
    })
    res.end(fs.readFileSync(path.join(DIST, serves)))
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` })))
}

async function get(base, pathname) {
  const r = await fetch(`${base}${pathname}`, { redirect: 'manual' })
  const body = Buffer.from(await r.arrayBuffer())
  return { status: r.status, headers: Object.fromEntries(r.headers), bytes: body.length, body }
}

async function assetsCheck(base) {
  const local = distFiles()
  const localAssets = local.filter((p) => p.startsWith('/assets/'))
  const problems = []
  const fetched = new Map()
  const fetchAll = async (paths) => {
    const todo = [...paths].filter((p) => !fetched.has(p))
    for (let i = 0; i < todo.length; i += 8) {
      await Promise.all(todo.slice(i, i + 8).map(async (p) => fetched.set(p, await get(base, p))))
    }
    return todo
  }
  // The entry chunk's dep map names every lazy chunk; the stylesheet names the fonts.
  await fetchAll(['/index.html'])
  let frontier = ['/index.html']
  while (frontier.length) {
    const refs = new Set()
    for (const p of frontier) {
      const r = fetched.get(p)
      if (r.status === 200 && /\.(html|js|css)$/.test(p)) for (const ref of assetRefs(r.body.toString())) refs.add(ref)
    }
    frontier = await fetchAll(refs)
  }
  await fetchAll(['/', ...local.filter((p) => !p.startsWith('/assets/'))])
  const deployedAssets = [...fetched.keys()].filter((p) => p.startsWith('/assets/'))
  for (const p of missingAssets(localAssets, deployedAssets)) problems.push(`${p}: no file of that name in the deployed build`)
  for (const [p, r] of fetched) problems.push(...responseProblems(p, r, vercel))
  return { problems, summary: `${fetched.size} files (${deployedAssets.length} hashed, ${localAssets.length} in the local build)` }
}

async function routesCheck(base) {
  const problems = []
  const page = await get(base, '/')
  const landing = await get(base, '/go/prod-check')
  problems.push(...responseProblems('/go/prod-check', landing, vercel))
  if (landing.status === 200 && !landing.body.equals(page.body)) problems.push('/go/prod-check: not the game page')
  const missing = `/prod-check-missing-${Date.now()}`
  const notFound = await get(base, missing)
  problems.push(...responseProblems(missing, notFound, vercel, 404).map((p) => p.replace(missing, '/<unknown path>')))
  const title404 = fs.readFileSync(path.join(DIST, '404.html'), 'utf8').match(/<title>[^<]*<\/title>/)?.[0]
  if (notFound.status === 404 && !notFound.body.toString().includes(title404)) problems.push('an unknown path does not get the 404 page')
  return { problems }
}

async function openPage(browser, base, query, options = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...options })
  const page = await ctx.newPage()
  const errors = []
  const origin = new URL(base).origin
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && !ignored(m.text()) && errors.push(`console: ${m.text()}`))
  page.on('response', (r) => r.status() >= 400 && r.url().startsWith(origin) && errors.push(`HTTP ${r.status()} ${r.url()}`))
  page.on('requestfailed', (r) => r.url().startsWith(origin) && errors.push(`${r.failure()?.errorText ?? 'failed'} ${r.url()}`))
  await page.goto(`${base}/?${query}`, { waitUntil: 'load' })
  await page.waitForFunction(() => !!window.__SC_TEST__, null, { timeout: 60000 })
  return { ctx, page, errors }
}

const hookErrors = (page) => page.evaluate(() => window.__SC_TEST__.errors)
const stats = (page) => page.evaluate(() => window.__SC_TEST__.stats())

async function pollFor(page, check, ms) {
  const until = Date.now() + ms
  while (!(await check())) {
    if (Date.now() >= until) return false
    await page.waitForTimeout(500)
  }
  return true
}

async function titleCheck(browser, base) {
  const { ctx, page, errors } = await openPage(browser, base, 'e2e=1')
  const problems = []
  const wait = await waitFrames(page, 10, { maxMs: 40000, pollMs: 500 })
  if (wait.frames < 10) problems.push(`render loop stalled (${wait.frames} frames in ${(wait.ms / 1000).toFixed(0)} s)`)
  let scene
  await pollFor(page, async () => {
    scene = await imageStats(page, await page.screenshot({ path: path.join(OUT, 'prod-title.png'), timeout: SHOT_TIMEOUT }), TITLE_UI)
    return !looksBlank(scene)
  }, 30000)
  if (looksBlank(scene)) problems.push('prod-title.png: the 3D scene behind the UI looks blank')
  if (!(await waitVisible(page, '.title-screen .play-button'))) problems.push('no PLAY button')
  errors.push(...(await hookErrors(page)))
  problems.push(...errors.slice(0, 5))
  await ctx.close()
  return { problems, summary: `frames=${wait.frames} in ${(wait.ms / 1000).toFixed(0)}s` }
}

async function killProblems(page) {
  const killEvents = () => page.evaluate(() => window.__SC_TEST__.combat.kills)
  const before = await killEvents()
  const hit = await page.evaluate(() => window.__SC_TEST__.killNearest(3))
  if (!hit) return ['killNearest(3) found no enemy to hit']
  if (!(await pollFor(page, async () => (await killEvents()) > before, 20000))) return [`${hit} hits never produced an enemy:killed`]
  return []
}

async function levelCheck(browser, base) {
  const { ctx, page, errors } = await openPage(browser, base, 'e2e=1')
  const problems = []
  await page.evaluate(([id, seed]) => window.__SC_TEST__.startLevel(id, seed), [LEVEL, SEED])
  await waitFrames(page, 10, { minMs: 4000, maxMs: 40000, pollMs: 500 })
  if (!(await pollFor(page, async () => (await stats(page)).onScreenEnemies > 0, 40000))) problems.push(`no enemy on screen in ${LEVEL}`)
  const before = await stats(page)
  const [pt] = await page.evaluate(() => window.__SC_TEST__.enemyScreenPoints(1))
  await page.mouse.click(pt?.x ?? 640, pt?.y ?? 360)
  if (!(await pollFor(page, async () => (await stats(page)).shotsFired > before.shotsFired, 10000))) problems.push('a mouse click fired no shot')
  problems.push(...(await killProblems(page)))
  await page.screenshot({ path: path.join(OUT, 'prod-level.png'), timeout: SHOT_TIMEOUT })
  const after = await stats(page)
  errors.push(...(await hookErrors(page)))
  problems.push(...errors.slice(0, 5))
  await ctx.close()
  return { problems, summary: `${LEVEL} kills=${after.kills} shots=${after.shotsFired} score=${after.score}` }
}

async function phoneCheck(browser, base) {
  const { defaultBrowserType: _unused, ...iphone } = devices['iPhone 13']
  const { ctx, page, errors } = await openPage(browser, base, `e2e=1&seed=${SEED}`, { ...iphone, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  const problems = []
  const phase = (want, ms) => pollFor(page, async () => (await page.evaluate(() => window.__SC_TEST__.phase())) === want, ms)
  if (!(await waitVisible(page, '.title-screen .play-button'))) problems.push('no PLAY button')
  await page.locator('.title-screen .play-button').tap({ timeout: 30000 })
  if (!(await phase('levelSelect', 15000))) problems.push('tapping PLAY did not open level select')
  await page.locator(`.level-card[data-level="${LEVEL}"]`).tap({ timeout: 30000 })
  if (!(await phase('playing', 15000))) problems.push('tapping the level card did not start the level')
  if (!(await pollFor(page, async () => (await stats(page)).onScreenEnemies > 0, 40000))) problems.push('no enemy on screen')
  // Taps must fire; whether a tapped bullet lands depends on the software frame rate (the nightly smoke gates aim assist).
  const before = await stats(page)
  for (let i = 0; i < 3; i++) {
    const [pt] = await page.evaluate(() => window.__SC_TEST__.enemyScreenPoints(1))
    await page.touchscreen.tap(pt?.x ?? 195, Math.min(pt?.y ?? 422, 844 - 80))
    await waitFrames(page, 1, { minMs: 80, maxMs: 4000, pollMs: 40 })
  }
  const shots = (await stats(page)).shotsFired - before.shotsFired
  if (!shots) problems.push('3 taps fired no shot')
  problems.push(...(await killProblems(page)))
  await page.screenshot({ path: path.join(OUT, 'prod-phone.png'), timeout: SHOT_TIMEOUT })
  const after = await stats(page)
  errors.push(...(await hookErrors(page)))
  problems.push(...errors.slice(0, 5))
  await ctx.close()
  return { problems, summary: `${LEVEL} tap shots=${shots} kills=${after.kills - before.kills}` }
}

async function run() {
  const started = Date.now()
  const local = args.url ? null : await serveDist()
  const base = (args.url ?? local.url).replace(/\/$/, '')
  report.url = base
  console.log(`Deploy health check of ${base} (local build: ${path.relative(process.cwd(), DIST) || '.'})`)
  await check('assets', () => assetsCheck(base))
  await check('routes', () => routesCheck(base))
  const browser = await launchBrowser(['--autoplay-policy=no-user-gesture-required'])
  await check('title', () => titleCheck(browser, base))
  await check('level', () => levelCheck(browser, base))
  await check('phone', () => phoneCheck(browser, base))
  await browser.close()
  local?.server.close()
  report.finished = true
  save()
  const failed = report.checks.filter((c) => !c.ok).length
  console.log(`${failed ? `${failed} check(s) failed` : 'All checks passed'} in ${((Date.now() - started) / 1000).toFixed(0)}s; prod-check.json + screenshots in ${OUT}`)
  process.exit(failed ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
