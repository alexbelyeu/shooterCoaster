import type { ArcTable } from '@/track/arcLength'

/**
 * XZ grid over the track's arc-table samples, for keeping props off it. Queries
 * are 2D on purpose: support towers run from the track down to the ground, so
 * anything near the track's ground projection can hit one however high it is.
 * Inside a tunnel (`ArcTable.tunnels`, #332) or another set-piece (`ArcTable.clearances`,
 * level 4's ice cave, #911) the track is as wide as it: a sample there counts within
 * `radius` + its `reach`.
 */
export interface TrackIndex {
  table: ArcTable
  /** Any sample within `radius` (XZ) of (x, z) that passes `filter` (gets the table index)? */
  near(x: number, z: number, radius: number, filter?: (i: number) => boolean): boolean
}

export interface TrackFrame {
  x: number
  y: number
  z: number
  /** Unit horizontal tangent; (0, 0) where the track is vertical. */
  tx: number
  tz: number
  /** Arc-table sample at or before this distance. */
  index: number
}

const CELL = 64
const STRIDE = 2

function cellKey(cx: number, cz: number): number {
  return (cx + 2048) * 4096 + (cz + 2048)
}

const indexCache = new WeakMap<ArcTable, TrackIndex>()

/** Built once per table and shared (the index is read-only). */
export function buildTrackIndex(table: ArcTable): TrackIndex {
  const cached = indexCache.get(table)
  if (cached) return cached
  const cells = new Map<number, number[]>()
  for (let i = 0; i < table.count; i += STRIDE) {
    const key = cellKey(Math.floor(table.x[i] / CELL), Math.floor(table.z[i] / CELL))
    let bucket = cells.get(key)
    if (!bucket) cells.set(key, (bucket = []))
    bucket.push(i)
  }
  const spans = [...(table.tunnels ?? []), ...(table.clearances ?? [])]
  let maxReach = 0
  for (const span of spans) maxReach = Math.max(maxReach, span.reach)
  const reachAt = (i: number) => {
    for (const span of spans) if (i >= span.from && i <= span.to) return span.reach
    return 0
  }

  const index: TrackIndex = {
    table,
    near(x, z, radius, filter) {
      const r2 = radius * radius
      const search = radius + maxReach
      const x0 = Math.floor((x - search) / CELL)
      const x1 = Math.floor((x + search) / CELL)
      const z0 = Math.floor((z - search) / CELL)
      const z1 = Math.floor((z + search) / CELL)
      for (let cx = x0; cx <= x1; cx++) {
        for (let cz = z0; cz <= z1; cz++) {
          const bucket = cells.get(cellKey(cx, cz))
          if (!bucket) continue
          for (const i of bucket) {
            const dx = table.x[i] - x
            const dz = table.z[i] - z
            const d2 = dx * dx + dz * dz
            if (d2 >= r2 && (maxReach === 0 || d2 >= (radius + reachAt(i)) ** 2)) continue
            if (!filter || filter(i)) return true
          }
        }
      }
      return false
    },
  }
  indexCache.set(table, index)
  return index
}

/** Track point and horizontal heading at arc distance `dist` (clamped). */
export function trackFrameAt(table: ArcTable, dist: number): TrackFrame {
  const { s, count } = table
  let lo = 0
  let hi = count - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (s[mid] <= dist) lo = mid
    else hi = mid
  }
  const span = s[hi] - s[lo]
  const f = span > 0 ? Math.min(1, Math.max(0, (dist - s[lo]) / span)) : 0
  const a = Math.max(0, lo - 2)
  const b = Math.min(count - 1, hi + 2)
  const dx = table.x[b] - table.x[a]
  const dz = table.z[b] - table.z[a]
  const len = Math.hypot(dx, dz)
  return {
    x: table.x[lo] + (table.x[hi] - table.x[lo]) * f,
    y: table.y[lo] + (table.y[hi] - table.y[lo]) * f,
    z: table.z[lo] + (table.z[hi] - table.z[lo]) * f,
    tx: len > 1e-6 ? dx / len : 0,
    tz: len > 1e-6 ? dz / len : 0,
    index: lo,
  }
}
