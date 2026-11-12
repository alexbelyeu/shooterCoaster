/** Page helpers shared by the smoke test (smoke.mjs) and the deploy health check (prod-check.mjs). */

// Console noise that is expected in headless/sandboxed runs and is not a game bug.
const IGNORED = [
  /AudioContext/i,
  /Failed to load resource/i,
  /net::ERR_/i,
  /WebGL.*(performance|GPU stall|ReadPixels)/i,
  /THREE\.WebGLRenderer: .*(extension|precision)/i,
  /Download the React DevTools/i,
]
export const ignored = (msg) => IGNORED.some((re) => re.test(msg))

/** Pixel stats of a PNG screenshot, computed in the page with a 2D canvas (no deps), leaving out the `skip` rects [x0, y0, x1, y1] (frame fractions). */
export async function imageStats(page, png, skip = []) {
  return page.evaluate(async ([b64, skip]) => {
    const img = new Image()
    img.src = `data:image/png;base64,${b64}`
    await img.decode()
    const c = document.createElement('canvas')
    c.width = 160
    c.height = 90
    const ctx = c.getContext('2d')
    ctx.drawImage(img, 0, 0, c.width, c.height)
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    let sum = 0, sumSq = 0, n = 0
    const colors = new Set()
    for (let i = 0; i < d.length; i += 4) {
      const x = ((i / 4) % c.width) / c.width
      const y = Math.floor(i / 4 / c.width) / c.height
      if (skip.some(([x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1)) continue
      const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      sum += l
      sumSq += l * l
      n++
      colors.add((d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4))
    }
    const mean = sum / n
    return { mean, stddev: Math.sqrt(sumSq / n - mean * mean), distinctColors: colors.size }
  }, [png.toString('base64'), skip])
}

export const looksBlank = (img) => img.stddev < 4 || img.distinctColors < 8

/** The title UI (logo, PLAY, hint; corner buttons and byline), left out so a black 3D scene behind it can't pass (#136). */
export const TITLE_UI = [[0.25, 0.25, 0.75, 0.75], [0, 0.85, 1, 1]]

export const getFrames = (page) => page.evaluate(() => window.__SC_TEST__.frames)

/** Poll until `n` more frames have rendered (and at least `minMs` passed), or `maxMs` elapses. */
export async function waitFrames(page, n, { minMs = 0, maxMs = 20000, pollMs = 250 } = {}) {
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

export function waitVisible(page, selector, timeout = 30000) {
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
 * Tap the centre of `selector` (#248). Playwright's `tap()` waits for the element to stop moving, and the title's PLAY
 * pulses forever (a scale about its centre, so the centre holds still): its "element is not stable" wait could time
 * out on a slow runner. Throws if the element is missing or something else is on top at its centre.
 */
export async function tapCentre(page, selector) {
  const hit = await page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return { error: `${sel} not found` }
    const r = el.getBoundingClientRect()
    const x = r.left + r.width / 2
    const y = r.top + r.height / 2
    const top = document.elementFromPoint(x, y)
    return el.contains(top) ? { x, y } : { error: `${sel} is covered at its centre by <${top?.tagName.toLowerCase()} class="${top?.className}">` }
  }, selector)
  if (hit.error) throw new Error(hit.error)
  await page.touchscreen.tap(hit.x, hit.y)
}
