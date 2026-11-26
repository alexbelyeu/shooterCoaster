import type { ArcTable } from '@/track/arcLength'
import type { Rng } from '@/utils/rng'
import type { Vec3 } from '@/utils/vec3'
import type { EnemyFloor } from './darkFloor'

/**
 * A wave over a landmark's top (#945: level 6's dust round the Flame, lifted by its fire, where the rider looks through the
 * roll across it): its members hang over the top, from just above it to `rise` higher, each on its own height (`EnemyFloor`).
 */

/** A raised top in world units: its centre, half sizes along its own x / z (turned `yaw` radians about y) and height. */
export interface PerchSpec {
  x: number
  z: number
  yaw: number
  halfLength: number
  halfWidth: number
  /** The top's height. */
  y: number
  /** From `lift` to `lift + rise` over the top a member hangs. */
  lift: number
  rise: number
  /** How far a member keeps from the rails' centreline, horizontally, where the track passes over the top at about its height. */
  railClear: number
}

/** Seeded at load, each in -1..1 across the top (`u` along it, `v` across) and 0..1 up its rise. */
export interface PerchSlot {
  u: number
  v: number
  h: number
}

/** One per even step along the top (jittered inside it), so no stretch of it is bare. */
export function perchSlots(count: number, rng: Rng): PerchSlot[] {
  return Array.from({ length: count }, (_, i) => ({ u: ((i + rng.range(0.2, 0.8)) / count) * 2 - 1, v: rng.range(-1, 1), h: rng() }))
}

/** Every 8th sample of the arc table: ~0.1 m apart on level 6's track, finer than any `railClear`. */
const TRACK_STRIDE = 8
const RAIL_TRIES = 4

/** Each slot's spot over the top, moved straight out from the nearest rails at about its height to `railClear`, and the height it hangs at. */
export function placeOnPerch(spec: PerchSpec, table: ArcTable, slots: readonly PerchSlot[]): { position: Vec3; floor: EnemyFloor }[] {
  const c = Math.cos(spec.yaw)
  const s = Math.sin(spec.yaw)
  return slots.map(({ u, v, h }) => {
    const a = u * spec.halfLength
    const b = v * spec.halfWidth
    const y = spec.y + spec.lift + h * spec.rise
    let x = spec.x + a * c + b * s
    let z = spec.z - a * s + b * c
    // Again from the spot it lands on, where two stretches of rails pass near it.
    for (let tries = 0; tries < RAIL_TRIES; tries++) {
      let near = -1
      let best = spec.railClear
      for (let i = 0; i < table.count; i += TRACK_STRIDE) {
        const d = Math.hypot(table.x[i] - x, table.z[i] - z)
        if (d < best && Math.abs(table.y[i] - y) < 2 * spec.railClear) [best, near] = [d, i]
      }
      if (near < 0) break
      const k = spec.railClear / (best || 1)
      x = table.x[near] + (x - table.x[near]) * k
      z = table.z[near] + (z - table.z[near]) * k
    }
    return { position: { x, y, z }, floor: { y, heading: 0 } }
  })
}
