#!/usr/bin/env node
/**
 * Enemy turntable (#380): every enemy and boss up close, from every side and in motion, under studio light.
 *
 *   npm run turntable                              # build dist-turntable/ + render everything
 *   npm run turntable -- --skip-build              # reuse dist-turntable/
 *   npm run turntable -- --only crow,kraken        # the sheet + these subjects' strips
 *   npm run turntable -- --biome ocean             # lit by a biome's atmosphere instead
 *
 * Writes to e2e-results/turntable/ (`--out`): sheet.png (every subject, 3/4 view), <id>-angles.png
 * (front / side / back / 3/4) and <id>-motion.png (four frames over one cycle), plus results.json. Fails on a page
 * error, a cell with nothing drawn in it, or an animated subject whose motion strip doesn't change.
 * The page is turntable.html (src/dev/turntable/), which `npm run dev` also serves; it never ships with the game.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { arg, launchBrowser, startPreview, stopPreview } from './headless.mjs'

const OUT = arg('out', 'e2e-results/turntable')
const DIST = 'dist-turntable'
const only = arg('only', '')
  .split(',')
  .filter(Boolean)
const biome = arg('biome', '')
/** Share of a cell that must differ from the background. */
const MIN_COVERAGE = 0.005
/** Mean per-channel change (0–255) that the busiest frame of an animated subject's strip must reach. */
const MIN_MOTION = 0.05

if (arg('skip-build') !== 'true') {
  execFileSync('npx', ['vite', 'build', '--mode', 'turntable', '--logLevel', 'warn'], { stdio: 'inherit' })
}
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })

const { url, proc } = await startPreview({ dist: DIST, page: '/turntable.html' })
const browser = await launchBrowser()
const failures = []
const results = {}
const errors = []
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(`${url}/turntable.html${biome ? `?biome=${biome}` : ''}`)
  await page.waitForFunction(() => window.__TT__?.ready, null, { timeout: 120_000 })
  const subjects = await page.evaluate(() => window.__TT__.subjects)
  const unknown = only.filter((id) => !subjects.includes(id))
  if (unknown.length) throw new Error(`unknown subject(s): ${unknown.join(', ')} (known: ${subjects.join(', ')})`)

  const boards = [{ kind: 'sheet', yaw: Math.PI / 4 }]
  for (const id of only.length ? only : subjects) boards.push({ kind: 'angles', id }, { kind: 'motion', id })

  for (const board of boards) {
    const name = board.kind === 'sheet' ? 'sheet' : `${board.id}-${board.kind}`
    const size = await page.evaluate((b) => window.__TT__.size(b), board)
    await page.setViewportSize(size)
    const result = await page.evaluate((b) => window.__TT__.draw(b), board)
    await page.screenshot({ path: path.join(OUT, `${name}.png`) })
    results[name] = result
    for (const cell of result.cells) {
      if (cell.coverage < MIN_COVERAGE) failures.push(`${name}: ${cell.subject} (${cell.caption}) drew nothing`)
    }
    if (board.kind === 'motion') {
      const animated = await page.evaluate((id) => window.__TT__.animated(id), board.id)
      const peak = Math.max(...result.change)
      const line = `${board.id.padEnd(14)} coverage ${result.cells.map((c) => c.coverage.toFixed(2)).join(' ')}  motion ${result.change.map((c) => c.toFixed(2)).join(' ')}`
      console.log(line)
      if (animated && !(peak >= MIN_MOTION)) failures.push(`${name}: motion strip frames are identical (peak change ${peak.toFixed(3)})`)
    }
  }
} catch (error) {
  failures.push(String(error?.stack ?? error))
} finally {
  // Here, so a board that throws midway still reports the page errors before it.
  failures.push(...errors.map((e) => `page error: ${e}`))
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2))
  await browser.close()
  stopPreview(proc)
}

if (failures.length) {
  console.error(`turntable FAILED:\n  ${failures.join('\n  ')}`)
  process.exit(1)
}
console.log(`turntable ok: ${Object.keys(results).length} images in ${OUT}/`)
