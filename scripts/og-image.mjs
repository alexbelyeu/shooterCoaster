#!/usr/bin/env node
/**
 * Renders the social preview card and the title posters from the built game, and the site icons from public/favicon.svg.
 *
 *   npm run build && npm run og        (cloud sessions: export SC_CHROME first, see CLAUDE.md)
 *   npm run og -- --icons              (only the icons: no build needed)
 *   npm run og -- --poster             (only the posters)
 *   npm run og -- --card               (only the share card)
 *
 * public/social/og-1200x630.jpg: a real level-1 gameplay frame, shot at a 1200x630
 * viewport after a short ride, with the muzzle flash, tracer and hitmarker held on a
 * kill frame (the `?e2e=1` hook's holdFeedback + killNearest). JPEG, because a PNG of
 * a rendered scene this size is ~1 MB and unfurlers want small images (docs/marketing/SEO.md). The title logo sits
 * over it, top centre between the HUD panels: the poster's inline SVG from the served index.html (#533).
 * The icons are public/favicon.svg (hand-written, the master) rasterised on a 2D canvas:
 * favicon.ico (16/32/48), apple-touch-icon.png (180) and the web app manifest's
 * icons/icon-192.png, icon-512.png and icon-maskable-512.png.
 *
 * public/poster/title-{landscape,portrait}.webp (#376): the title scene with no UI, its camera held at the
 * first moments of the fly-by, which index.html's #poster shows before any JS runs and crossfades into the live scene.
 *
 * Options: --icons, --poster (only the posters), --card (only the share card), --level level1 --seconds 8 --url http://localhost:4173 (skip vite preview)
 */
import { arg, launchBrowser, startPreview, stopPreview } from './headless.mjs'
import fs from 'node:fs'
import path from 'node:path'

const LEVEL = arg('level', 'level1')
const RIDE_SECONDS = Number(arg('seconds', 8))
const ICONS_ONLY = process.argv.includes('--icons')
const POSTER_ONLY = process.argv.includes('--poster')
const CARD_ONLY = process.argv.includes('--card')
/** Phones get the portrait still, everything else the landscape one (index.html's media queries). Small: under the startup JS. */
const POSTERS = [
  { file: 'public/poster/title-landscape.webp', width: 960, height: 540, maxBytes: 60 * 1024 },
  { file: 'public/poster/title-portrait.webp', width: 540, height: 1080, maxBytes: 60 * 1024 },
]
/** The title camera's time in the still: where the live fly-by is as the poster fades into it. */
const POSTER_TITLE_TIME_S = 0.3
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
  await addLogo(page)
  await waitFrames(page, 2)
  for (const quality of [85, 78, 70, 60]) {
    const jpg = await page.screenshot({ type: 'jpeg', quality, timeout: TIMEOUT })
    if (jpg.length <= MAX_OG_BYTES) return { jpg, quality }
  }
  throw new Error('og image is over 300 KB even at quality 60')
}

/** The poster's still logo, read from the served index.html: the poster itself is gone by now. */
async function addLogo(page) {
  await page.evaluate(async () => {
    const html = await (await fetch('/')).text()
    const svg = new DOMParser().parseFromString(html, 'text/html').querySelector('#poster .poster-logo svg')
    if (!svg) throw new Error('og: index.html has no poster logo')
    const box = document.createElement('div')
    box.style.cssText = 'position: fixed; top: 22px; left: 50%; transform: translateX(-50%); width: 500px; z-index: 1000; pointer-events: none; filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.45));'
    svg.setAttribute('width', '100%')
    svg.style.cssText = 'display: block; height: auto; overflow: visible;'
    box.append(document.importNode(svg, true))
    document.body.append(box)
    await document.fonts.load('700 160px Lobster')
    await document.fonts.ready
  })
}

/** The title scene alone (no UI, no poster) at the poster's size, as WebP under its byte cap. */
async function shootPoster(browser, url, { width, height, maxBytes }) {
  const page = await browser.newPage({ viewport: { width, height } })
  await page.goto(`${url}/?e2e=1`)
  await page.waitForFunction(() => !!window.__SC_TEST__, null, { timeout: TIMEOUT })
  await page.evaluate((t) => (window.__SC_TEST__.titleTime = t), POSTER_TITLE_TIME_S)
  await page.addStyleTag({ content: 'body > :not(#root), #root > :not(:has(canvas)) { visibility: hidden !important; }' })
  await page.waitForFunction(() => window.__SC_TEST__.initTimings().titleFrame !== undefined, null, { timeout: TIMEOUT })
  await waitFrames(page, 6, 1000)
  const png = (await page.locator('canvas').screenshot({ timeout: TIMEOUT })).toString('base64')
  const out = await page.evaluate(
    async ([b64, cap]) => {
      const img = new Image()
      img.src = `data:image/png;base64,${b64}`
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      c.getContext('2d').drawImage(img, 0, 0)
      for (const quality of [0.8, 0.72, 0.64, 0.56, 0.48]) {
        const data = c.toDataURL('image/webp', quality).split(',')[1]
        if (data.length * 0.75 <= cap) return { data, quality }
      }
      return null
    },
    [png, maxBytes],
  )
  await page.close()
  if (!out) throw new Error(`poster ${width}x${height} is over ${maxBytes / 1024} KB even at WebP quality 0.48`)
  return { webp: Buffer.from(out.data, 'base64'), quality: out.quality }
}

async function writePosters(browser, url) {
  for (const poster of POSTERS) {
    const { webp, quality } = await shootPoster(browser, url, poster)
    fs.mkdirSync(path.dirname(poster.file), { recursive: true })
    fs.writeFileSync(poster.file, webp)
    console.log(`og: ${poster.file} ${poster.width}x${poster.height} q${quality} ${Math.round(webp.length / 1024)} KB`)
  }
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
    const url = given ?? preview.url
    if (!POSTER_ONLY) {
      const { jpg, quality } = await shootCard(page, url)
      fs.mkdirSync(path.dirname(OG_FILE), { recursive: true })
      fs.writeFileSync(OG_FILE, jpg)
      console.log(`og: ${path.relative('.', OG_FILE)} 1200x630 q${quality} ${Math.round(jpg.length / 1024)} KB`)
    }
    if (!CARD_ONLY) await writePosters(browser, url)
  }
  if (!POSTER_ONLY && !CARD_ONLY) await writeIcons(page)
  await browser.close()
} finally {
  if (preview) stopPreview(preview.proc)
}
