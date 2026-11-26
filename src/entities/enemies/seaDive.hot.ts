import type { EnemyType } from '@/types/level'

/**
 * Level 3's sea creatures don't wait to be shot (#1059): once the rider has seen one (ahead, inside `cone` and `range`), it
 * stays `stay` seconds, then dives under in `diveS` and is gone, unscored. A miss is a lost score, so the rider tracks from one
 * to the next instead of clearing a queue.
 */
export const SEA_DIVE = {
  stay: { jellyfish: 4, shark: 4.5, flyingFish: 4.5 } as Partial<Record<EnemyType, number>>,
  diveS: 0.8,
  /** How far it sinks over the dive: under the surface, out of the rider's sight. */
  depth: 45,
  range: 1100,
  /** Cosine of the half-angle that counts as seen (~50°, inside a 16:9 frame's width). */
  cone: 0.64,
} as const

export interface DiveClock {
  /** Game second the rider first saw it; -1 before. */
  seenAt: number
}

/**
 * Its dive at game second `time`: 0 while unseen or staying, rising through 1 as it goes under (1 or more: gone).
 * `dx, dy, dz` is it from the camera, `fx, fy, fz` the camera's unit forward.
 */
export function diveProgress(
  clock: DiveClock,
  time: number,
  stay: number,
  dx: number,
  dy: number,
  dz: number,
  fx: number,
  fy: number,
  fz: number,
): number {
  if (clock.seenAt < 0) {
    const dist = Math.hypot(dx, dy, dz)
    if (dist > SEA_DIVE.range || dx * fx + dy * fy + dz * fz < SEA_DIVE.cone * dist) return 0
    clock.seenAt = time
  }
  return Math.max(0, (time - clock.seenAt - stay) / SEA_DIVE.diveS)
}
