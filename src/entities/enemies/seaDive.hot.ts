import type { EnemyType } from '@/types/level'

/**
 * Level 3's sea creatures don't wait to be shot (#1059): once the rider has seen one (`riderSight.ts`, inside `seenCos` and
 * `near`), it stays `stay` seconds, then dives under in `diveS` and is gone, unscored. A miss is a lost score, so the rider
 * tracks from one to the next instead of clearing a queue.
 */
export const SEA_DIVE = {
  stay: { jellyfish: 4, shark: 4.5, flyingFish: 4.5 } as Partial<Record<EnemyType, number>>,
  diveS: 0.8,
  /** How far it sinks over the dive: under the surface, out of the rider's sight. */
  depth: 45,
  near: 1100,
  /** Cosine off the rider's look that counts as seen (~50°, inside a 16:9 frame's width). */
  seenCos: 0.64,
} as const

/**
 * Its dive `seen` game seconds after the rider first saw it (negative: not yet): 0 while unseen or staying, rising through 1
 * as it goes under (1 or more: gone).
 */
export function diveProgress(seen: number, stay: number): number {
  return seen < 0 ? 0 : Math.max(0, (seen - stay) / SEA_DIVE.diveS)
}
