import type { ArcTable } from '@/track/arcLength'
import type { HeightFunction } from '@/utils/terrainNoise'
import type { RockRing } from '../../shared/ringedRock'
import { buildTrackIndex, trackFrameAt } from '../../shared/trackClearance'
import { createRng, groundedBaseY, trackExtent } from '../../shared/trackScatter'
import { LANDMARK_FOOTPRINTS } from './landmarks'

/** Where the desert's mesas and dust devils go (pure, unit-tested against the level 2 track). */

type Circle = { x: number; z: number; r: number }

// Talus apron, a cliff with a ledge, a narrower top tier, flat top. Scale 1.
export const MESA_RINGS: readonly RockRing[] = [
  { y: 0, r: 140 },
  { y: 45, r: 112 },
  { y: 70, r: 100 },
  { y: 115, r: 97, ox: 2 },
  { y: 165, r: 94, ox: 3 },
  { y: 165, r: 78, ox: 6, oz: 4 },
  { y: 210, r: 75, ox: 6, oz: 4 },
  { y: 250, r: 72, ox: 7, oz: 5 },
  { y: 250, r: 60, ox: 10, oz: 2 },
  { y: 300, r: 57, ox: 10, oz: 2 },
]
export const MESA_JITTER = 0.08
export const MESA_HEIGHT = 300
export const MESA_FOOTPRINT = 140 * (1 + MESA_JITTER)

export interface Mesa {
  x: number
  y: number
  z: number
  scale: number
  yaw: number
}

export interface MesaOptions {
  count: number
  minRadius: number
  maxRadius: number
  /** XZ gap to the track: its towers reach the ground. */
  clearance: number
  /** Max gap, so the ride threads between the mesas. */
  maxGap: number
  scaleRange: [number, number]
  spacing: number
  avoid: readonly Circle[]
  rng: () => number
}

export function placeMesas(groundFn: HeightFunction, track: ArcTable, opts: MesaOptions): Mesa[] {
  const { count, minRadius, maxRadius, clearance, maxGap, scaleRange, spacing, avoid, rng } = opts
  const index = buildTrackIndex(track)
  const out: Mesa[] = []
  for (let attempts = 0; out.length < count && attempts < count * 200; attempts++) {
    const theta = rng() * Math.PI * 2
    const r = minRadius + rng() * (maxRadius - minRadius)
    const x = Math.cos(theta) * r
    const z = Math.sin(theta) * r
    const scale = scaleRange[0] + rng() * (scaleRange[1] - scaleRange[0])
    const reach = MESA_FOOTPRINT * scale
    if (out.some((m) => Math.hypot(m.x - x, m.z - z) < spacing)) continue
    if (avoid.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + reach)) continue
    if (index.near(x, z, reach + clearance)) continue
    if (!index.near(x, z, reach + maxGap)) continue
    const y = groundedBaseY(groundFn, x, z, reach, 6)
    if (groundFn(x, z) - y > MESA_HEIGHT * scale * 0.33) continue
    out.push({ x, y, z, scale, yaw: rng() * Math.PI * 2 })
  }
  return out
}

export interface DustDevil {
  cx: number
  cz: number
  /** The foot stays within hypot(driftX, driftZ) of (cx, cz). */
  driftX: number
  driftZ: number
  driftSpeed: number
  phase: number
  height: number
  /** Radius at the top; the foot is a fifth of it. */
  radius: number
  spin: number
}

export interface DustDevilOptions {
  count: number
  offset: [number, number]
  drift: number
  /** Beyond the drift circle; must cover the column's lean + top radius (DustDevils.tsx, ~95). */
  clearance: number
  avoid: readonly Circle[]
  rng: () => number
}

/** Spread evenly along the ride, alternating sides, so one is in view most of the time. */
export function placeDustDevils(track: ArcTable, opts: DustDevilOptions): DustDevil[] {
  const { count, offset, drift, clearance, avoid, rng } = opts
  const index = buildTrackIndex(track)
  const out: DustDevil[] = []
  for (let i = 0; i < count; i++) {
    for (let attempt = 0; attempt < 24; attempt++) {
      const along = ((i + 0.3 + rng() * 0.4) / count) * track.length
      const f = trackFrameAt(track, along)
      if (f.tx === 0 && f.tz === 0) continue
      const side = (i + attempt) % 2 === 0 ? 1 : -1
      const d = offset[0] + rng() * (offset[1] - offset[0])
      const cx = f.x - f.tz * d * side
      const cz = f.z + f.tx * d * side
      if (index.near(cx, cz, drift + clearance)) continue
      if (avoid.some((c) => Math.hypot(c.x - cx, c.z - cz) < c.r + drift + 40)) continue
      if (out.some((o) => Math.hypot(o.cx - cx, o.cz - cz) < drift * 3)) continue
      const a = rng() * Math.PI * 2
      out.push({
        cx,
        cz,
        driftX: Math.cos(a) * drift,
        driftZ: Math.sin(a) * drift,
        driftSpeed: 0.12 + rng() * 0.1,
        phase: rng() * Math.PI * 2,
        height: 200 + rng() * 90,
        radius: 34 + rng() * 14,
        spin: (rng() < 0.5 ? -1 : 1) * (2.2 + rng() * 1.2),
      })
      break
    }
  }
  return out
}

/** Column foot at time `t` (s): two slow sines, never further than the drift from the centre. */
export function dustDevilCenter(d: DustDevil, t: number, out: { x: number; z: number }): void {
  const a = d.phase + d.driftSpeed * t
  const s = 0.8 * Math.sin(a)
  const c = 0.6 * Math.cos(a * 0.6 + d.phase)
  out.x = d.cx + d.driftX * s - d.driftZ * c
  out.z = d.cz + d.driftZ * s + d.driftX * c
}

export interface DesertLayout {
  mesas: Mesa[]
  devils: DustDevil[]
}

export function layoutDesert(groundFn: HeightFunction, track: ArcTable): DesertLayout {
  const extent = trackExtent(track)
  const mesas = placeMesas(groundFn, track, {
    count: 5,
    minRadius: extent * 0.6,
    maxRadius: extent * 1.3,
    clearance: 60,
    maxGap: 320,
    scaleRange: [0.85, 1.2],
    spacing: 520,
    avoid: LANDMARK_FOOTPRINTS,
    rng: createRng(23),
  })
  const devils = placeDustDevils(track, {
    count: 4,
    offset: [260, 480],
    drift: 90,
    clearance: 120,
    avoid: [...LANDMARK_FOOTPRINTS, ...mesas.map((m) => ({ x: m.x, z: m.z, r: MESA_FOOTPRINT * m.scale }))],
    rng: createRng(2301),
  })
  return { mesas, devils }
}
