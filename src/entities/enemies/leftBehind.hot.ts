import type { Vec3 } from '@/utils/vec3'

/**
 * A flying formation member the rider has gone past unshot flies back round to it (#1020). A V marches at the rider
 * and a ring's or a spiral's members wander (`FlapBird`), so one the rider passed would otherwise fly on out of sight
 * for the rest of the run, live but never shootable: on level 8 six toucans did, the finale after the Golden Blimp
 * was empty and the run could never clear. Behind the look and further than `distance` for `seconds` of game time
 * (a bird the rider only turned from for a moment, in a bank or a helix, stays where it is), it heads for `ahead`
 * in front of the rider and `up` above its eye, `speed` (units a 60 Hz frame, `FlapBird`'s) faster than the rider
 * rides, until it is out in front again (`backInFront`), where the rider comes up on it.
 */
export const LEFT_BEHIND = { seconds: 3, distance: 400, ahead: 700, up: 80, speed: 1.8, view: Math.cos((25 * Math.PI) / 180) }

/** Whether `p` is behind the rider's look (`forward` from `eye`). */
export function behindLook(p: Vec3, eye: Vec3, forward: Vec3): boolean {
  return (p.x - eye.x) * forward.x + (p.y - eye.y) * forward.y + (p.z - eye.z) * forward.z < 0
}

/** Whether `p` is behind the rider's look and further than `LEFT_BEHIND.distance`. */
export function leftBehind(p: Vec3, eye: Vec3, forward: Vec3): boolean {
  const d = LEFT_BEHIND.distance
  return behindLook(p, eye, forward) && (p.x - eye.x) ** 2 + (p.y - eye.y) ** 2 + (p.z - eye.z) ** 2 > d * d
}

/**
 * Whether a bird flying back is out in front again: at least half `LEFT_BEHIND.ahead` off, within `LEFT_BEHIND.view`
 * (a cosine) of the look, so on screen rather than only off to the side of it.
 */
export function backInFront(p: Vec3, eye: Vec3, forward: Vec3): boolean {
  const dx = p.x - eye.x
  const dy = p.y - eye.y
  const dz = p.z - eye.z
  const d = Math.hypot(dx, dy, dz)
  const look = Math.hypot(forward.x, forward.y, forward.z) || 1
  return d > LEFT_BEHIND.ahead / 2 && (dx * forward.x + dy * forward.y + dz * forward.z) / (d * look) >= LEFT_BEHIND.view
}

/**
 * Moves `p` `step` units toward the spot a left-behind bird heads for (`LEFT_BEHIND.ahead` along the look's level
 * heading, `up` above the eye) and returns its XZ heading (`atan2(dz, dx)`), the one its model turns to.
 */
export function flyBackStep(p: Vec3, eye: Vec3, forward: Vec3, step: number): number {
  const level = Math.hypot(forward.x, forward.z) || 1
  const dx = eye.x + (forward.x / level) * LEFT_BEHIND.ahead - p.x
  const dy = eye.y + LEFT_BEHIND.up - p.y
  const dz = eye.z + (forward.z / level) * LEFT_BEHIND.ahead - p.z
  const d = Math.hypot(dx, dy, dz)
  if (d > 0) {
    const k = Math.min(1, step / d)
    p.x += dx * k
    p.y += dy * k
    p.z += dz * k
  }
  return Math.atan2(dz, dx)
}
