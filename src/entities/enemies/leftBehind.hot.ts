import type { Vec3 } from '@/utils/vec3'

/**
 * A flying formation member the rider has gone past unshot flies back round to it (#1020). A V marches at the rider
 * and a ring's or a spiral's members wander (`FlapBird`), so one the rider passed would otherwise fly on out of sight
 * for the rest of the run, live but never shootable: on level 8 six toucans did, the finale after the Golden Blimp
 * was empty and the run could never clear. Behind the look and further than 400 units (past the rider, not passing
 * over it), it climbs over the rider and heads for 700 along the look and 80 above the eye, 1.8 units a 60 Hz frame (`FlapBird`'s units) faster than the rider rides, until it is out in front
 * again: 350 off and within 25° of the look (cosine 0.9: on screen, not only off to the side of it), where the rider
 * comes up on it. The numbers are written in place: the bundle has no room for their names (`budgets.json`).
 */

/** A bird's fly-back state: whether it is flying back. */
export interface FlyBack {
  flying: boolean
}

/**
 * Advances `s` by `seconds` of game time for a bird at `p` (moved while flying back), the rider's `eye` having ridden
 * `rode` since the last call and looking along `forward` (a unit vector). Returns the bird's XZ heading while it flies
 * back (`atan2(dz, dx)`, the one its model turns to), else null: it moves on its own. `start` false (the boss fight, #1022)
 * starts no new fly-back; one already flying back finishes.
 */
export function flyBack(s: FlyBack, p: Vec3, eye: Vec3, forward: Vec3, seconds: number, rode: number, start: boolean): number | null {
  let dx = p.x - eye.x
  let dy = p.y - eye.y
  let dz = p.z - eye.z
  const d = Math.hypot(dx, dy, dz)
  const cos = (dx * forward.x + dy * forward.y + dz * forward.z) / d
  s.flying = s.flying ? !(cos >= 0.9 && d > 350) : start && cos < 0 && d > 400
  if (!s.flying) return null
  // Still beside or behind the rider, it climbs over it first (150 ahead, 300 above the eye), never through the seat.
  const ahead = cos < 0.3 ? 150 : 700
  dx = eye.x + forward.x * ahead - p.x
  dy = eye.y + forward.y * ahead + (cos < 0.3 ? 300 : 80) - p.y
  dz = eye.z + forward.z * ahead - p.z
  // It turns back out of its flight while still short of the spot, so a step never overshoots it.
  const k = (rode + 108 * seconds) / Math.hypot(dx, dy, dz)
  p.x += dx * k
  p.y += dy * k
  p.z += dz * k
  return Math.atan2(dz, dx)
}
