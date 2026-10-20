/**
 * Projectile motion + swept hit test (pure, unit-tested; no three.js imports).
 *
 * Bullets used to move a fixed 14 units per *frame*, so at phone frame rates
 * they flew slowly and missed moving targets, and a point-in-sphere test could
 * let a fast bullet skip straight through a small enemy between two frames.
 * Motion is now per second (scaled by the frame delta) and hits are tested
 * against the segment the bullet swept this frame.
 */

export interface Vec3Like {
  x: number
  y: number
  z: number
}

/** World units per second. Matches the old 14 units/frame at 60 fps. */
export const BULLET_SPEED_PER_SEC = 14 * 60

/**
 * Longest single step (seconds). Only guards against a huge delta after a
 * stall (e.g. a backgrounded tab); real frame times, even ~2 fps, are below it,
 * so travel per second is the same at any normal frame rate.
 */
export const MAX_BULLET_STEP_SEC = 0.5

/** Advance `pos` along the unit vector `dir` for `dtSec` seconds. Mutates and returns `pos`. */
export function stepBullet(pos: Vec3Like, dir: Vec3Like, speedPerSec: number, dtSec: number): Vec3Like {
  const dt = Math.min(Math.max(dtSec, 0), MAX_BULLET_STEP_SEC)
  const d = speedPerSec * dt
  pos.x += dir.x * d
  pos.y += dir.y * d
  pos.z += dir.z * d
  return pos
}

/**
 * True if the segment a→b passes within sqrt(radiusSq) of centre c.
 * Scalar arguments so the per-frame collision loop never allocates.
 */
export function segmentHitsSphere(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  cx: number, cy: number, cz: number,
  radiusSq: number,
): boolean {
  const abx = bx - ax
  const aby = by - ay
  const abz = bz - az
  const acx = cx - ax
  const acy = cy - ay
  const acz = cz - az
  const lenSq = abx * abx + aby * aby + abz * abz
  let t = lenSq > 0 ? (acx * abx + acy * aby + acz * abz) / lenSq : 0
  if (t < 0) t = 0
  else if (t > 1) t = 1
  const dx = acx - abx * t
  const dy = acy - aby * t
  const dz = acz - abz * t
  return dx * dx + dy * dy + dz * dz < radiusSq
}
