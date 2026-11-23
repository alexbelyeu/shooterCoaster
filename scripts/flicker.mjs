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
