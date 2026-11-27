/**
 * Enemies that slip away (#1059): once the rider has one in sight (within `near`, ahead of its look) it stays `linger` s,
 * then goes over `goS` (`distance` units: into the snow, under the sand, up out of the frame) and is gone, unscored. One
 * left too long is a lost score, not one that waits to be shot. Ages are game seconds since the rider first had it in
 * sight (a pause holds them).
 */
export interface SlipAway {
  near: number
  /** Cosine off the rider's look within which it counts as seen. */
  seenCos: number
  linger: number
  goS: number
  distance: number
}

/** Level 4's snowmen sink into the snow, past the tallest (the brute, ~1.8x the snowman model). */
export const SNOW_SINK: SlipAway = { near: 1300, seenCos: 0.7, linger: 5, goS: 0.8, distance: 220 }

/** Level 2's scorpions burrow into the sand, past the tip of the tail (~70 at its scale of 8). */
export const SAND_BURROW: SlipAway = { near: 1300, seenCos: 0.7, linger: 5, goS: 0.6, distance: 120 }

/** Level 2's crows climb out of the top of the frame. */
export const CROW_FLEE: SlipAway = { near: 1500, seenCos: 0.7, linger: 4.5, goS: 1.2, distance: 900 }

/** Level 8's toucans climb out of the top of the frame. */
export const TOUCAN_FLEE: SlipAway = { near: 1500, seenCos: 0.7, linger: 3, goS: 1.2, distance: 900 }

/** Level 5's embers rise on the heat out of the top of the frame (#1059). */
export const EMBER_RISE: SlipAway = { near: 1300, seenCos: 0.7, linger: 6, goS: 1.2, distance: 900 }

/** Level 5's drakes climb out of the top of the frame. */
export const DRAKE_FLEE: SlipAway = { near: 1500, seenCos: 0.7, linger: 6, goS: 1.2, distance: 900 }

/** Level 5's imps and golems sink back into the lava crust, past the golem's head (~70 at its scale). */
export const LAVA_SINK: SlipAway = { near: 1300, seenCos: 0.7, linger: 4, goS: 0.8, distance: 120 }

/** How far it has gone: 0 while it stays, easing in so it starts slowly, then goes. */
export function slipOffset(s: SlipAway, seen: number): number {
  const u = (seen - s.linger) / s.goS
  if (u <= 0) return 0
  return s.distance * Math.min(1, u * u)
}

export function slipped(s: SlipAway, seen: number): boolean {
  return seen >= s.linger + s.goS
}
