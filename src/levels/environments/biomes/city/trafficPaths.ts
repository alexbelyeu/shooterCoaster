import type { ArcTable } from '@/track/arcLength'
import { buildTrackIndex } from '@/levels/environments/shared/trackClearance'
import { createRng } from '@/utils/rng'
import { STREET_GRID, type Tower } from './cityLayout'

/** Neon Metropolis's traffic (#324), pure and seeded: lanes cut into runs clear of the towers (the skyline and the hero tower stand across some streets) and of the track's supports. */

/** A lane's offset from its street's centre line: one lane each way. */
const LANE_OFFSET = 11
const STEP = 8
/** A run shorter than this carries no car. */
const MIN_RUN = 160
/** Clearance from a tower's faces, and from the track's projection (its support towers' legs splay). */
const TOWER_MARGIN = 10
const TRACK_MARGIN = 44
/** A street's gap between cars (world units): busy avenues to quiet side streets. */
const GAP = { min: 130, max: 380 } as const
const SPEED = { min: 60, max: 110 } as const
/** Within `length` of a run's ends a car sinks up to `depth` into the road: it leaves and joins the street out of sight. */
export const SINK = { length: 26, depth: 9 } as const

/** Every car as flat arrays, shuffled so any prefix thins the traffic evenly. */
export interface Traffic {
  count: number
  /** Run start (x, y, z) per car. */
  start: Float32Array
  /** Unit heading (x, z) per car. */
  dir: Float32Array
  /** Run length, distance along it at t = 0, speed. */
  run: Float32Array
}

interface Run {
  x: number
  z: number
  dx: number
  dz: number
  length: number
}

function cutRuns(x0: number, z0: number, dx: number, dz: number, length: number, blocked: (x: number, z: number) => boolean, out: Run[]): void {
  let from = -1
  for (let s = 0; s <= length; s += STEP) {
    const free = !blocked(x0 + dx * s, z0 + dz * s)
    if (free && from < 0) from = s
    const end = !free || s + STEP > length
    if (end && from >= 0) {
      const to = free ? s : s - STEP
      if (to - from >= MIN_RUN) out.push({ x: x0 + dx * from, z: z0 + dz * from, dx, dz, length: to - from })
      from = -1
    }
  }
}

/** Every lane run, both ways down each street of `STREET_GRID` inside radius `reach`, clear of `towers` and the track. */
export function laneRuns(track: ArcTable, reach: number, towers: readonly Tower[]): Run[] {
  const index = buildTrackIndex(track)
  const { pitch } = STREET_GRID
  const runs: Run[] = []
  const n = Math.ceil(reach / pitch)
  for (let k = -n; k < n; k++) {
    const line = (k + 0.5) * pitch
    for (const alongX of [true, false]) {
      for (const way of [1, -1]) {
        const across = line + way * (alongX ? LANE_OFFSET : -LANE_OFFSET)
        if (Math.abs(across) >= reach) continue
        const half = Math.sqrt(reach * reach - across * across)
        const inBand = towers.filter((t) => Math.abs((alongX ? t.z : t.x) - across) < (alongX ? t.d : t.w) / 2 + TOWER_MARGIN)
        const blocked = (x: number, z: number) =>
          index.near(x, z, TRACK_MARGIN) ||
          inBand.some((t) => Math.abs(x - t.x) < t.w / 2 + TOWER_MARGIN && Math.abs(z - t.z) < t.d / 2 + TOWER_MARGIN)
        const a = -half * way
        if (alongX) cutRuns(a, across, way, 0, half * 2, blocked, runs)
        else cutRuns(across, a, 0, way, half * 2, blocked, runs)
      }
    }
  }
  return runs
}

/** Seeded cars on `runs`; `groundY` is the road's height (the city is flat). */
export function layoutTraffic(runs: readonly Run[], groundY: number, seed = 7324): Traffic {
  const rng = createRng(seed)
  const cars: number[][] = []
  for (const r of runs) {
    const gap = rng.range(GAP.min, GAP.max)
    const speed = rng.range(SPEED.min, SPEED.max)
    const n = Math.max(1, Math.floor(r.length / gap))
    for (let i = 0; i < n; i++) {
      // One speed a lane, so its cars never pass through one another
      const at = ((i + rng.range(0, 0.6)) / n) * r.length
      cars.push([r.x, groundY, r.z, r.dx, r.dz, r.length, at, speed])
    }
  }
  for (let i = cars.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[cars[i], cars[j]] = [cars[j], cars[i]]
  }
  const start = new Float32Array(cars.length * 3)
  const dir = new Float32Array(cars.length * 2)
  const run = new Float32Array(cars.length * 3)
  cars.forEach((c, i) => {
    start.set(c.slice(0, 3), i * 3)
    dir.set(c.slice(3, 5), i * 2)
    run.set(c.slice(5, 8), i * 3)
  })
  return { count: cars.length, start, dir, run }
}
