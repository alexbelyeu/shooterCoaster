import type { TrackCurve } from './curves/TrackCurve'

/**
 * Dense arc-length lookup for a track curve. Track curves are parametric in t
 * with very uneven speed, so anything that must be evenly spaced along the
 * track (ties, support towers) samples by distance through this table.
 */
export interface ArcTable {
  /** Number of samples (n + 1 entries, t = 0 … 1). */
  count: number
  t: Float64Array
  /** Cumulative arc length at each sample. */
  s: Float64Array
  x: Float64Array
  y: Float64Array
  z: Float64Array
  length: number
}

export function buildArcTable(curve: TrackCurve, n = 8192): ArcTable {
  const count = n + 1
  const t = new Float64Array(count)
  const s = new Float64Array(count)
  const x = new Float64Array(count)
  const y = new Float64Array(count)
  const z = new Float64Array(count)
  let len = 0
  for (let i = 0; i < count; i++) {
    const ti = i / n
    // getPointAt returns a shared vector — copy components out immediately.
    const p = curve.getPointAt(ti)
    t[i] = ti
    x[i] = p.x
    y[i] = p.y
    z[i] = p.z
    if (i > 0) {
      const dx = x[i] - x[i - 1]
      const dy = y[i] - y[i - 1]
      const dz = z[i] - z[i - 1]
      len += Math.sqrt(dx * dx + dy * dy + dz * dz)
    }
    s[i] = len
  }
  return { count, t, s, x, y, z, length: len }
}

/** Curve parameter t at arc distance `dist` (clamped to [0, length]). */
export function tAtDistance(table: ArcTable, dist: number): number {
  const { s, t, count } = table
  if (dist <= 0) return 0
  if (dist >= table.length) return 1
  let lo = 0
  let hi = count - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (s[mid] < dist) lo = mid
    else hi = mid
  }
  const span = s[hi] - s[lo]
  const f = span > 0 ? (dist - s[lo]) / span : 0
  return t[lo] + (t[hi] - t[lo]) * f
}

/** Arc distance from t = 0 to `t` (clamped to [0, 1]); the inverse of `tAtDistance`. */
export function distanceAtT(table: ArcTable, t: number): number {
  const n = table.count - 1
  const x = Math.min(Math.max(t, 0), 1) * n
  const i = Math.min(Math.floor(x), n - 1)
  return table.s[i] + (table.s[i + 1] - table.s[i]) * (x - i)
}

/** Nearest sample index to curve parameter `t` (wrapped to [0, 1)); the table samples t evenly. */
export function indexAtT(table: ArcTable, t: number): number {
  const n = table.count - 1
  return Math.round((((t % 1) + 1) % 1) * n) % n
}

/** `tAtDistance` on a closed loop: any distance wraps around the seam. */
export function tAtLoopDistance(table: ArcTable, dist: number): number {
  const len = table.length
  return len > 0 ? tAtDistance(table, ((dist % len) + len) % len) : 0
}
