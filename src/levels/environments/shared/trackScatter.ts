import type { HeightFunction, TrackSample } from '@/utils/terrainNoise'

/**
 * Track-aware scatter helpers (pure: no three/React, unit-tested). Decorations
 * that should frame the ride (crystals, drifts) are scattered around the track
 * instead of uniformly over the map, so the mid-ground the rider actually sees
 * is dense while the far hills stay sparse.
 */

export interface ScatterPoint {
  x: number
  y: number
  z: number
}

/** Small deterministic PRNG (mulberry32) so a level's scatter is the same every run. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Furthest horizontal distance of the track from the origin (≈ varC * 13 * scalar). */
export function trackExtent(samples: readonly TrackSample[]): number {
  let max = 0
  for (const s of samples) max = Math.max(max, Math.hypot(s.x, s.z))
  return max
}

/** Horizontal distance from (x, z) to the nearest track sample. */
export function distanceToTrack(samples: readonly TrackSample[], x: number, z: number): number {
  let best = Infinity
  for (const s of samples) {
    const dx = x - s.x
    const dz = z - s.z
    const d2 = dx * dx + dz * dz
    if (d2 < best) best = d2
  }
  return Math.sqrt(best)
}

export interface NearTrackScatterOptions {
  count: number
  trackSamples: readonly TrackSample[]
  heightFn: HeightFunction
  /** Horizontal clearance from the track centreline (keeps props out of the train's path and the towers). */
  minDist: number
  /** Furthest offset from the track. */
  maxDist: number
  /** Hard limit on distance from the origin. */
  maxRadius: number
  /** Slope rejection angle in radians. */
  maxSlope: number
  /** Exponent on the offset distribution; > 1 concentrates props near the track. */
  bias: number
  rng: () => number
}

/**
 * Scatter points around the track: pick a random track sample, step out by an
 * offset biased towards `minDist`, and reject points too close to any part of
 * the track, beyond `maxRadius` or on slopes steeper than `maxSlope`.
 * `y` is `heightFn` at the point; grounded props should re-sample the drawn
 * surface (see `groundedBaseY`).
 */
export function scatterNearTrack(opts: NearTrackScatterOptions): ScatterPoint[] {
  const { count, trackSamples, heightFn, minDist, maxDist, maxRadius, maxSlope, bias, rng } = opts
  const out: ScatterPoint[] = []
  if (trackSamples.length === 0) return out
  const maxSlopeTan = Math.tan(maxSlope)
  const delta = 5
  for (let attempts = 0; out.length < count && attempts < count * 20; attempts++) {
    const s = trackSamples[Math.floor(rng() * trackSamples.length)]
    const offset = minDist + (maxDist - minDist) * Math.pow(rng(), bias)
    const theta = rng() * Math.PI * 2
    const x = s.x + Math.cos(theta) * offset
    const z = s.z + Math.sin(theta) * offset
    if (Math.hypot(x, z) > maxRadius) continue
    if (distanceToTrack(trackSamples, x, z) < minDist) continue
    const y = heightFn(x, z)
    const dx = (heightFn(x + delta, z) - y) / delta
    const dz = (heightFn(x, z + delta) - y) / delta
    if (Math.hypot(dx, dz) > maxSlopeTan) continue
    out.push({ x, y, z })
  }
  return out
}

/**
 * Base height for a prop with a footprint of `radius` on the *drawn* terrain
 * (`groundFn` = createTerrainSurface): the lowest surface point under the
 * footprint, minus `sink`. Using the minimum means no edge of the base ever
 * hangs in the air; on a slope the uphill side is buried instead.
 */
export function groundedBaseY(
  groundFn: HeightFunction,
  x: number,
  z: number,
  radius: number,
  sink: number,
): number {
  let min = groundFn(x, z)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    min = Math.min(min, groundFn(x + Math.cos(a) * radius, z + Math.sin(a) * radius))
  }
  return min - sink
}

export interface GroundedProp extends ScatterPoint {
  /** Uniform scale; `y` is the base height for that scale (see groundedBaseY). */
  scale: number
}

/**
 * Settle candidate points onto the drawn terrain with a random uniform scale,
 * keeping the first `count` whose base buries at most `maxBury` (a fraction) of
 * the prop's height: the base sits at the lowest ground under the footprint, so
 * on uneven ground the uphill side sinks. `footprint` and `height` are at scale 1.
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
