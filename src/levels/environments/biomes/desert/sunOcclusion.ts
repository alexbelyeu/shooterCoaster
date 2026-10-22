import type { HeightFunction } from '@/utils/terrainNoise'

/** A landmark the sun can hide behind, as a vertical cone frustum. */
export interface Occluder {
  x: number
  z: number
  baseY: number
  topY: number
  baseR: number
  topR: number
}

interface Vec3 {
  x: number
  y: number
  z: number
}

/** Terrain beyond the fog (6000) is never drawn in front of the sun. */
const MAX_DISTANCE = 6000
const FIRST_STEP = 20
const GROWTH = 1.22

/**
 * 1 if the ray from `origin` towards the sun (unit `dir`) passes under the drawn
 * terrain or through an occluder, else 0. Marches with growing steps (~30
 * terrain samples), so ridges thinner than a step far away can be missed;
 * the depth-tested flare core still hides behind them.
 */
export function sunOcclusion(
  origin: Vec3,
  dir: Vec3,
  groundFn: HeightFunction,
  occluders: readonly Occluder[],
): number {
  for (let d = FIRST_STEP; d < MAX_DISTANCE; d *= GROWTH) {
    if (groundFn(origin.x + dir.x * d, origin.z + dir.z * d) > origin.y + dir.y * d) return 1
  }
  const h2 = dir.x * dir.x + dir.z * dir.z
  if (h2 < 1e-8) return 0
  for (const o of occluders) {
    // Closest approach of the ray's XZ projection to the occluder's axis.
    const t = ((o.x - origin.x) * dir.x + (o.z - origin.z) * dir.z) / h2
    if (t <= 0) continue
    const y = origin.y + dir.y * t
    if (y < o.baseY || y > o.topY) continue
    const dist = Math.hypot(origin.x + dir.x * t - o.x, origin.z + dir.z * t - o.z)
    const r = o.baseR + ((o.topR - o.baseR) * (y - o.baseY)) / (o.topY - o.baseY)
    if (dist < r) return 1
  }
  return 0
}
