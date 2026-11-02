#!/usr/bin/env node
/**
 * Renders the social preview card from the built game, and the site icons from public/favicon.svg.
 *
 *   npm run build && npm run og        (cloud sessions: export SC_CHROME first, see CLAUDE.md)
 *   npm run og -- --icons              (only the icons: no build needed)
 *
 * public/social/og-1200x630.jpg: a real level-1 gameplay frame, shot at a 1200x630
 * viewport after a short ride, with the muzzle flash, tracer and hitmarker held on a
 * kill frame (the `?e2e=1` hook's holdFeedback + killNearest). JPEG, because a PNG of
 * a rendered scene this size is ~1 MB and unfurlers want small images (docs/marketing/SEO.md).
 * The icons are public/favicon.svg (hand-written, the master) rasterised on a 2D canvas:
 * favicon.ico (16/32/48), apple-touch-icon.png (180) and the web app manifest's
 * icons/icon-192.png, icon-512.png and icon-maskable-512.png.
 *
 * Options: --icons, --level level1 --seconds 8 --url http://localhost:4173 (skip vite preview)
 */
import { launchBrowser, startPreview, stopPreview } from './headless.mjs'
import fs from 'node:fs'
import path from 'node:path'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : fallback
}
const LEVEL = arg('level', 'level1')
const RIDE_SECONDS = Number(arg('seconds', 8))
const ICONS_ONLY = process.argv.includes('--icons')
const OG_FILE = path.resolve('public/social/og-1200x630.jpg')
const SVG_FILE = path.resolve('public/favicon.svg')
const ICO_FILE = path.resolve('public/favicon.ico')
const MAX_OG_BYTES = 300 * 1024
const TIMEOUT = 120000

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

/** Rasterise favicon.svg at `size` px; `inset` < 1 shrinks the crosshair into a maskable icon's safe zone. */
async function rasterIcon(page, size, inset = 1) {
  let svg = fs.readFileSync(SVG_FILE, 'utf8')
  if (inset !== 1) {
    const offset = (180 * (1 - inset)) / 2
    svg = svg.replace('<g id="mark">', `<g id="mark" transform="translate(${offset} ${offset}) scale(${inset})">`)
  }
  const b64 = await page.evaluate(
    async ([markup, px]) => {
      const img = new Image()
      img.src = `data:image/svg+xml;base64,${btoa(markup)}`
      await img.decode()
      const c = document.createElement('canvas')
      c.width = c.height = px
      c.getContext('2d').drawImage(img, 0, 0, px, px)
      return c.toDataURL('image/png').split(',')[1]
    },
    [svg, size],
  )
  return Buffer.from(b64, 'base64')
}

/** An .ico of PNG images: a 6-byte header (type 1 = icon), one 16-byte directory entry per image, then the PNGs. */
function icoFromPngs(images) {
  const header = Buffer.alloc(6 + 16 * images.length)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = header.length
  images.forEach(({ size, png }, i) => {
    const entry = 6 + 16 * i
    header.writeUInt8(size % 256, entry)
    header.writeUInt8(size % 256, entry + 1)
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(png.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += png.length
  })
  return Buffer.concat([header, ...images.map((image) => image.png)])
}

async function writeIcons(page) {
  const save = (file, bytes, label) => {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, bytes)
    console.log(`og: ${path.relative('.', file)} ${label} ${Math.round(bytes.length / 1024)} KB`)
  }
  const png = async (file, size, inset) => save(path.resolve(file), await rasterIcon(page, size, inset), `${size}x${size}`)
  await png('public/apple-touch-icon.png', 180)
  await png('public/icons/icon-192.png', 192)
  await png('public/icons/icon-512.png', 512)
  // Maskable: the whole crosshair inside the centre circle of radius 40% that every mask keeps (web.dev).
  await png('public/icons/icon-maskable-512.png', 512, 0.78)
  const sizes = [16, 32, 48]
  const images = []
  for (const size of sizes) images.push({ size, png: await rasterIcon(page, size) })
  save(ICO_FILE, icoFromPngs(images), sizes.join('/'))
}

let preview
try {
  const browser = await launchBrowser()
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
  if (!ICONS_ONLY) {
    const given = arg('url')
    if (!given) preview = await startPreview()
    const { jpg, quality } = await shootCard(page, given ?? preview.url)
    fs.mkdirSync(path.dirname(OG_FILE), { recursive: true })
    fs.writeFileSync(OG_FILE, jpg)
    console.log(`og: ${path.relative('.', OG_FILE)} 1200x630 q${quality} ${Math.round(jpg.length / 1024)} KB`)
  }
  await writeIcons(page)
  await browser.close()
} finally {
  if (preview) stopPreview(preview.proc)
}
