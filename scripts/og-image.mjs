#!/usr/bin/env node
/**
 * Renders the social preview card and the apple-touch-icon from the built game.
 *
 *   npm run build && npm run og        (cloud sessions: export SC_CHROME first, see CLAUDE.md)
 *
 * public/social/og-1200x630.jpg: a real level-1 gameplay frame, shot at a 1200x630
 * viewport after a short ride, with the muzzle flash, tracer and hitmarker held on a
 * kill frame (the `?e2e=1` hook's holdFeedback + killNearest). JPEG, because a PNG of
 * a rendered scene this size is ~1 MB and unfurlers want small images.
 * public/apple-touch-icon.png: a 180x180 crosshair drawn on a 2D canvas.
 *
 * Options: --level level1 --seconds 8 --url http://localhost:4173 (skip vite preview)
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : fallback
}
const LEVEL = arg('level', 'level1')
const RIDE_SECONDS = Number(arg('seconds', 8))
const OG_FILE = path.resolve('public/social/og-1200x630.jpg')
const ICON_FILE = path.resolve('public/apple-touch-icon.png')
const MAX_OG_BYTES = 300 * 1024
const TIMEOUT = 120000

async function startPreview() {
  const port = 4900 + Math.floor(Math.random() * 500)
  const url = `http://localhost:${port}`
  const proc = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
    stdio: 'ignore',
    detached: true, // own process group, so the vite grandchild dies with npx
  })
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) return { url, proc }
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  process.kill(-proc.pid, 'SIGTERM')
  throw new Error('vite preview did not start (did you run `npm run build`?)')
}

/** Wait until `n` more frames have rendered and at least `minMs` passed. */
async function waitFrames(page, n, minMs = 0) {
  const start = Date.now()
  const f0 = await page.evaluate(() => window.__SC_TEST__.frames)
  await page.waitForFunction(
    ([f, t, ms]) => window.__SC_TEST__.frames >= f && Date.now() - t >= ms,
    [f0 + n, start, minMs],
    { timeout: TIMEOUT, polling: 100 },
  )
}

async function shootCard(page, url) {
  await page.goto(`${url}/?e2e=1`)
  await page.waitForFunction(() => window.__SC_TEST__?.levels().length > 0, null, { timeout: TIMEOUT })
  await page.evaluate((id) => window.__SC_TEST__.startLevel(id), LEVEL)
  await waitFrames(page, 10, RIDE_SECONDS * 1000)
  // A few seconds of autofire builds a combo, then one held kill frame.
  await page.evaluate(() => window.__SC_TEST__.autoFire(true))
  await waitFrames(page, 4, 3000)
  const kills = await page.evaluate(() => {
    const s = window.__SC_TEST__
    s.autoFire(false)
    s.holdFeedback = true
    const before = s.combat.kills
    s.killNearest(3)
    return before
  })
  await page
    .waitForFunction((k) => window.__SC_TEST__.combat.kills > k, kills, { timeout: 15000 })
    .catch(() => console.warn('og: no kill event; the card will lack the hitmarker'))
  await page.evaluate(() => window.__SC_TEST__.setTimeScale(0))
  await waitFrames(page, 2)
  for (const quality of [85, 78, 70, 60]) {
    const jpg = await page.screenshot({ type: 'jpeg', quality, timeout: TIMEOUT })
    if (jpg.length <= MAX_OG_BYTES) return { jpg, quality }
  }
  throw new Error('og image is over 300 KB even at quality 60')
}

/** 180x180 icon: gold crosshair ring on the title-screen sky. */
async function drawIcon(page) {
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 180
    const g = c.getContext('2d')
    const sky = g.createLinearGradient(0, 0, 0, 180)
    sky.addColorStop(0, '#2f7fd6')
    sky.addColorStop(1, '#9fd4ff')
    g.fillStyle = sky
    g.fillRect(0, 0, 180, 180)
    g.strokeStyle = '#ffd23f'
    g.lineCap = 'round'
    g.lineWidth = 12
    g.beginPath()
    g.arc(90, 90, 50, 0, Math.PI * 2)
    g.stroke()
    g.lineWidth = 10
    for (const [x0, y0, x1, y1] of [[90, 20, 90, 58], [90, 122, 90, 160], [20, 90, 58, 90], [122, 90, 160, 90]]) {
      g.beginPath()
      g.moveTo(x0, y0)
      g.lineTo(x1, y1)
      g.stroke()
    }
    g.fillStyle = '#ff3b3b'
    g.beginPath()
    g.arc(90, 90, 10, 0, Math.PI * 2)
    g.fill()
    return c.toDataURL('image/png').split(',')[1]
  })
  return Buffer.from(b64, 'base64')
}

let preview
try {
  const given = arg('url')
  if (!given) preview = await startPreview()
  const url = given ?? preview.url
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.SC_CHROME || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
  })
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
  const { jpg, quality } = await shootCard(page, url)
  fs.mkdirSync(path.dirname(OG_FILE), { recursive: true })
  fs.writeFileSync(OG_FILE, jpg)
  console.log(`og: ${path.relative('.', OG_FILE)} 1200x630 q${quality} ${Math.round(jpg.length / 1024)} KB`)
  const icon = await drawIcon(page)
  fs.writeFileSync(ICON_FILE, icon)
  console.log(`og: ${path.relative('.', ICON_FILE)} 180x180 ${Math.round(icon.length / 1024)} KB`)
  await browser.close()
} finally {
  if (preview) process.kill(-preview.proc.pid, 'SIGTERM')
}
