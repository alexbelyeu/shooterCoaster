import type { ArcTable } from '@/track/arcLength'
import type { HeightFunction } from '@/utils/terrainNoise'
import { buildTrackIndex } from './trackClearance'

/** Scatter props around the track rather than uniformly over the map (pure, unit-tested). */

export interface ScatterPoint {
  x: number
  y: number
  z: number
}

/** Furthest XZ reach of the track from the origin (≈ varC * 13 * scalar). */
export function trackExtent(table: ArcTable): number {
  let max = 0
  for (let i = 0; i < table.count; i++) max = Math.max(max, Math.hypot(table.x[i], table.z[i]))
  return max
}

export interface NearTrackScatterOptions {
  count: number
  track: ArcTable
  heightFn: HeightFunction
  /** Horizontal clearance from the track centreline (keeps props off the rails and towers). */
  minDist: number
  maxDist: number
  maxRadius: number
  maxSlope: number
  /** Exponent on the offset distribution; > 1 concentrates props near the track. */
  bias: number
  rng: () => number
}

/** Points offset from random arc-table samples, rejecting any too close to the track, too far out or too steep. */
export function scatterNearTrack(opts: NearTrackScatterOptions): ScatterPoint[] {
  const { count, track, heightFn, minDist, maxDist, maxRadius, maxSlope, bias, rng } = opts
  const out: ScatterPoint[] = []
  if (track.count === 0) return out
  const index = buildTrackIndex(track)
  const maxSlopeTan = Math.tan(maxSlope)
  const delta = 5
  for (let attempts = 0; out.length < count && attempts < count * 20; attempts++) {
    const i = Math.floor(rng() * track.count)
    const offset = minDist + (maxDist - minDist) * Math.pow(rng(), bias)
    const theta = rng() * Math.PI * 2
    const x = track.x[i] + Math.cos(theta) * offset
    const z = track.z[i] + Math.sin(theta) * offset
    if (Math.hypot(x, z) > maxRadius) continue
    if (index.near(x, z, minDist)) continue
    const y = heightFn(x, z)
    const dx = (heightFn(x + delta, z) - y) / delta
    const dz = (heightFn(x, z + delta) - y) / delta
    if (Math.hypot(dx, dz) > maxSlopeTan) continue
    out.push({ x, y, z })
  }
  return out
}

/** Lowest drawn ground under a round footprint (centre, half and full radius: dips hide inside the rim), minus `sink`. */
export function groundedBaseY(
  groundFn: HeightFunction,
  x: number,
  z: number,
  radius: number,
  sink: number,
): number {
  let min = groundFn(x, z)
  for (const r of [radius * 0.5, radius]) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      min = Math.min(min, groundFn(x + Math.cos(a) * r, z + Math.sin(a) * r))
    }
  }
  return min - sink
}

export interface GroundedProp extends ScatterPoint {
  scale: number
}

/**
 * Give each point a random uniform scale and sit it on `groundedBaseY`, keeping the
 * first `count` whose uphill side is buried by at most `maxBury` of the height
 * (`footprint` and `height` at scale 1).
 */
export function settleOnGround(
  points: readonly ScatterPoint[],
  groundFn: HeightFunction,
  opts: {
    count: number
    scaleRange: [number, number]
    footprint: number
    height: number
    sink: number
    maxBury: number
    rng: () => number
  },
): GroundedProp[] {
  const { count, scaleRange, footprint, height, sink, maxBury, rng } = opts
  const out: GroundedProp[] = []
  for (const p of points) {
    if (out.length === count) break
    const scale = scaleRange[0] + rng() * (scaleRange[1] - scaleRange[0])
    const y = groundedBaseY(groundFn, p.x, p.z, footprint * scale, sink)
    if (groundFn(p.x, p.z) - y > height * scale * maxBury) continue
    out.push({ x: p.x, y, z: p.z, scale })
  }
  return out
}
