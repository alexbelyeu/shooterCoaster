import zlib from 'node:zlib'

/**
 * Flicker spikes (#925, `rideReview.mjs`): a screen region whose brightness jumps for one step and comes straight back.
 * The camera moves smoothly, so a region that does that is a light popping on and off, z-fighting or a sprite blinking
 * (the gym's Training Area ceiling, Alex's playtest of 23 Nov), not the ride.
 */

/** Regions across and down the screen. */
export const FLICKER_GRID = { cols: 8, rows: 6 }
/** Luma (0-255) a region must jump to count, and how near its step-before value it must come back. */
export const FLICKER_JUMP = 18
export const FLICKER_RETURN = 6

const ROW_NAMES = ['top', 'upper', 'high-mid', 'low-mid', 'lower', 'bottom']

/** Mean luma of each grid region of one probe frame. */
export function regionMeans({ width, height, luma }, grid = FLICKER_GRID) {
  const sums = new Float64Array(grid.cols * grid.rows)
  const counts = new Uint32Array(grid.cols * grid.rows)
  for (let y = 0; y < height; y++) {
    const r = Math.min(grid.rows - 1, Math.floor((y * grid.rows) / height))
    for (let x = 0; x < width; x++) {
      const c = Math.min(grid.cols - 1, Math.floor((x * grid.cols) / width))
      sums[r * grid.cols + c] += luma[y * width + x]
      counts[r * grid.cols + c]++
    }
  }
  return Array.from(sums, (s, i) => (counts[i] ? s / counts[i] : 0))
}

/**
 * Regions that spiked, most spikes first: `{ region, count, first, peak, times }`.
 * @param {{ t: number, width: number, height: number, luma: Float32Array }[]} probes in time order
 */
export function flickerSpikes(probes, grid = FLICKER_GRID) {
  const means = probes.map((p) => regionMeans(p, grid))
  const found = new Map()
  for (let i = 1; i + 1 < means.length; i++) {
    for (let k = 0; k < means[i].length; k++) {
      const before = means[i - 1][k]
      const jump = means[i][k] - before
      if (Math.abs(jump) < FLICKER_JUMP || Math.abs(means[i + 1][k] - before) > FLICKER_RETURN) continue
      const r = Math.floor(k / grid.cols)
      const region = `${ROW_NAMES[r] ?? `row ${r}`} ${k % grid.cols + 1}/${grid.cols}`
      const f = found.get(region) ?? { region, count: 0, first: probes[i].t, peak: 0, times: [] }
      f.count++
      f.peak = Math.max(f.peak, Math.abs(jump))
      if (f.times.length < 20) f.times.push(Number(probes[i].t.toFixed(2)))
      found.set(region, f)
    }
  }
  return [...found.values()].sort((a, b) => b.count - a.count)
}

/** Decodes an 8-bit RGB / RGBA non-interlaced PNG (what CDP returns) to luma rows. */
export function pngLuma(buf) {
  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)
  const colorType = buf[25]
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0
  if (buf[24] !== 8 || !channels || buf[28] !== 0) throw new Error(`pngLuma: unsupported PNG (depth ${buf[24]}, colour ${colorType})`)
  const idat = []
  for (let at = 8; at < buf.length; ) {
    const len = buf.readUInt32BE(at)
    if (buf.toString('ascii', at + 4, at + 8) === 'IDAT') idat.push(buf.subarray(at + 8, at + 8 + len))
    at += 12 + len
  }
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const prev = new Uint8Array(stride)
  const row = new Uint8Array(stride)
  const luma = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? row[i - channels] : 0
      const b = prev[i]
      const c = i >= channels ? prev[i - channels] : 0
      let v = line[i]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      row[i] = v & 255
    }
    for (let x = 0; x < width; x++) {
      const i = x * channels
      luma[y * width + x] = 0.2126 * row[i] + 0.7152 * row[i + 1] + 0.0722 * row[i + 2]
    }
    prev.set(row)
  }
  return { width, height, luma }
}
