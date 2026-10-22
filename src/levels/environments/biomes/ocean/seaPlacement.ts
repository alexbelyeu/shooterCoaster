import type { ArcTable } from '@/track/arcLength'
import type { HeightFunction } from '@/utils/terrainNoise'
import { createRng, groundedBaseY, scatterNearTrack, trackExtent, type ScatterPoint } from '../../shared/trackScatter'
import { KELP_HEIGHT, ROCK_FOOTPRINT, ROCK_HEIGHT, STACK_FOOTPRINT, STACK_HEIGHT } from './seaDimensions'

/** Where the ocean props go (pure). The water surface is y = 0. */
export interface SeabedProp extends ScatterPoint {
  scale: number
  yaw: number
}

/** Highest drawn ground under a round footprint. */
export function maxGroundUnder(groundFn: HeightFunction, x: number, z: number, radius: number): number {
  let max = groundFn(x, z)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    max = Math.max(max, groundFn(x + Math.cos(a) * radius, z + Math.sin(a) * radius))
  }
  return max
}

export interface SeaStackOptions {
  count: number
  minRadius: number
  maxRadius: number
  footprint: number
  scaleRange: [number, number]
  spacing: number
  avoid: readonly { x: number; z: number; r: number }[]
  rng: () => number
}

/** The whole footprint must be at least 6 under the surface, so every stack stands in open water. */
export function placeSeaStacks(groundFn: HeightFunction, opts: SeaStackOptions): SeabedProp[] {
  const { count, minRadius, maxRadius, footprint, scaleRange, spacing, avoid, rng } = opts
  const out: SeabedProp[] = []
  for (let attempts = 0; out.length < count && attempts < count * 80; attempts++) {
    const theta = rng() * Math.PI * 2
    const r = minRadius + rng() * (maxRadius - minRadius)
    const x = Math.cos(theta) * r
    const z = Math.sin(theta) * r
    const scale = scaleRange[0] + rng() * (scaleRange[1] - scaleRange[0])
    const radius = footprint * scale
    if (out.some((p) => Math.hypot(p.x - x, p.z - z) < spacing)) continue
    if (avoid.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + radius)) continue
    if (maxGroundUnder(groundFn, x, z, radius) > -6) continue
    out.push({ x, y: groundedBaseY(groundFn, x, z, radius, 4), z, scale, yaw: rng() * Math.PI * 2 })
  }
  return out
}

export interface BreachingRockOptions {
  count: number
  track: ArcTable
  minDist: number
  maxDist: number
  maxRadius: number
  footprint: number
  height: number
  topRange: [number, number]
  spacing: number
  rng: () => number
}

/** Each rock is scaled so its top lands `topRange` above the water, whatever the depth. */
export function placeBreachingRocks(groundFn: HeightFunction, opts: BreachingRockOptions): SeabedProp[] {
  const { count, track, minDist, maxDist, maxRadius, footprint, height, topRange, spacing, rng } = opts
  const candidates = scatterNearTrack({
    count: count * 4,
    track,
    heightFn: groundFn,
    minDist,
    maxDist,
    maxRadius,
    maxSlope: Math.PI / 3,
    bias: 1.4,
    rng,
  })
  const out: SeabedProp[] = []
  for (const p of candidates) {
    if (out.length === count) break
    if (out.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < spacing)) continue
    const top = topRange[0] + rng() * (topRange[1] - topRange[0])
    // Two passes: the footprint (and so the base) depends on the scale.
    let base = groundedBaseY(groundFn, p.x, p.z, footprint, 3)
    let scale = (top - base) / height
    base = groundedBaseY(groundFn, p.x, p.z, footprint * scale, 3)
    scale = (top - base) / height
    if (maxGroundUnder(groundFn, p.x, p.z, footprint * scale) > -10) continue
    out.push({ x: p.x, y: base, z: p.z, scale, yaw: rng() * Math.PI * 2 })
  }
  return out
}

export interface ReefOptions {
  count: number
  track: ArcTable
  minDist: number
  maxDist: number
  maxRadius: number
  maxGroundY: number
  scaleRange: [number, number]
  rng: () => number
}

export function placeReef(groundFn: HeightFunction, opts: ReefOptions): SeabedProp[] {
  const { count, track, minDist, maxDist, maxRadius, maxGroundY, scaleRange, rng } = opts
  const candidates = scatterNearTrack({
    count: count * 2,
    track,
    heightFn: groundFn,
    minDist,
    maxDist,
    maxRadius,
    maxSlope: Math.PI / 5,
    bias: 1.2,
    rng,
  })
  const out: SeabedProp[] = []
  for (const p of candidates) {
    if (out.length === count) break
    if (p.y > maxGroundY) continue
    const scale = scaleRange[0] + rng() * (scaleRange[1] - scaleRange[0])
    out.push({ x: p.x, y: p.y - 1, z: p.z, scale, yaw: rng() * Math.PI * 2 })
  }
  return out
}

/** `speed` in rad/s; its sign is the direction of travel. */
export interface GullOrbit {
  cx: number
  cz: number
  radius: number
  y: number
  speed: number
  phase: number
}

export function placeGullOrbits(
  stacks: readonly { x: number; z: number; top: number }[],
  count: number,
  flocks: number,
  rng: () => number,
): GullOrbit[] {
  const out: GullOrbit[] = []
  const used = stacks.slice(0, flocks)
  if (used.length === 0) return out
  for (let i = 0; i < count; i++) {
    const flock = i % used.length
    const s = used[flock]
    const dir = flock % 2 === 0 ? 1 : -1
    out.push({
      cx: s.x + (rng() - 0.5) * 40,
      cz: s.z + (rng() - 0.5) * 40,
      radius: 70 + rng() * 90,
      y: s.top + 30 + rng() * 70,
      speed: dir * (0.25 + rng() * 0.2),
      phase: rng() * Math.PI * 2,
    })
  }
  return out
}

const KELP_TIP_DEPTH = 6

export interface OceanLayout {
  stacks: SeabedProp[]
  rocks: SeabedProp[]
  gulls: GullOrbit[]
  coral: SeabedProp[]
  kelp: SeabedProp[]
}

/** Seeded: the same layout every run. `avoid` keeps stacks off landmarks. */
export function layoutOcean(
  groundFn: HeightFunction,
  track: ArcTable,
  avoid: readonly { x: number; z: number; r: number }[],
): OceanLayout {
  const extent = trackExtent(track)
  const stacks = placeSeaStacks(groundFn, {
    count: 8,
    minRadius: extent * 1.3,
    maxRadius: extent * 2.3,
    footprint: STACK_FOOTPRINT,
    scaleRange: [0.85, 1.35],
    spacing: 380,
    avoid,
    rng: createRng(21),
  })
  const rocks = placeBreachingRocks(groundFn, {
    count: 18,
    track,
    minDist: 90,
    maxDist: 450,
    maxRadius: extent * 1.15,
    footprint: ROCK_FOOTPRINT,
    height: ROCK_HEIGHT,
    topRange: [5, 22],
    spacing: 70,
    rng: createRng(2101),
  })
  // Gulls circle the stacks nearest the ride; further out they shrink to specks.
  const nearest = [...stacks]
    .sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))
    .map((s) => ({ x: s.x, z: s.z, top: s.y + STACK_HEIGHT * s.scale }))
  const gulls = placeGullOrbits(nearest, 10, 3, createRng(2102))
  const coral = placeReef(groundFn, {
    count: 110,
    track,
    minDist: 30,
    maxDist: 600,
    maxRadius: extent * 1.25,
    maxGroundY: -15,
    scaleRange: [1, 1.9],
    rng: createRng(2103),
  })
  const kelp = placeReef(groundFn, {
    count: 90,
    track,
    minDist: 40,
    maxDist: 600,
    maxRadius: extent * 1.25,
    maxGroundY: -20,
    scaleRange: [0.8, 1.2],
    rng: createRng(2104),
  }).map((p) => ({ ...p, scale: Math.min(p.scale, (-KELP_TIP_DEPTH - p.y) / KELP_HEIGHT) }))
  return { stacks, rocks, gulls, coral, kelp }
}
