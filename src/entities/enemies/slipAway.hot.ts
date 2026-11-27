/**
 * Enemies that slip away (#1059): once the rider has one in sight (within `near`, ahead of its look) it stays `linger` s,
 * then goes over `goS` (`distance` units: up out of the frame) and is gone, unscored. One left too long is a lost score,
 * not one that waits to be shot. Ages are game seconds since the rider first had it in sight (a pause holds them).
 */
export interface SlipAway {
  near: number
  /** Cosine off the rider's look within which it counts as seen. */
  seenCos: number
  linger: number
  goS: number
  distance: number
}

/** Level 8's toucans climb out of the top of the frame. */
export const TOUCAN_FLEE: SlipAway = { near: 1500, seenCos: 0.7, linger: 3, goS: 1.2, distance: 900 }

/** How far it has gone: 0 while it stays, easing in so it starts slowly, then goes. */
export function slipOffset(s: SlipAway, seen: number): number {
  const u = (seen - s.linger) / s.goS
  if (u <= 0) return 0
  return s.distance * Math.min(1, u * u)
}

export function slipped(s: SlipAway, seen: number): boolean {
  return seen >= s.linger + s.goS
}
