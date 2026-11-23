/**
 * Keeps a ground enemy's wander near its spawn slot beside the track (#210), so a long wave doesn't carry it out of
 * the readable band. Pure, per frame; `dt` is in 60 fps frames as the enemies' `updatePosition` uses it.
 */

interface XZ {
  x: number
  z: number
}

/** How far (world units) a ground enemy may wander from its spawn slot. */
export const WANDER_LEASH = 400

/**
 * The orbit wander's turn rate (radians per game second), raised where needed so the circle fits the leash. An orbit
 * at `speed` (per 60 fps frame) turning `theta` has radius 60·speed/θ², and wherever on the circle it starts it is never
 * more than the diameter from there. Turning faster, not walking slower, keeps the enemy's pace.
 */
export function leashedTurnRate(speed: number, theta: number, leash = WANDER_LEASH): number {
  return Math.max(theta, Math.sqrt((120 * speed) / leash))
}

/** One frame of orbit wander at a turn rate from `leashedTurnRate`. */
export function orbitStep(pos: XZ, time: number, dt: number, speed: number, theta: number) {
  pos.z += ((speed * Math.cos(time * theta)) / theta) * dt
  pos.x += ((speed * Math.sin(time * theta)) / theta) * dt
}

/** A straight-line walker's heading: back toward `home` once `pos` is past the leash, else `heading`. */
export function leashedHeading(pos: XZ, home: XZ, heading: number, leash = WANDER_LEASH): number {
  const dx = home.x - pos.x
  const dz = home.z - pos.z
  return dx * dx + dz * dz > leash * leash ? Math.atan2(dz, dx) : heading
}
