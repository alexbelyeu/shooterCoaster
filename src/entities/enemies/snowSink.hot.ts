/**
 * Level 4's snowmen slip back into the snow (#1059): once the rider has one in sight (within `near`, ahead of its look) it
 * stands `linger` s, then sinks into the drift over `sinkS` and is gone, unscored. A snowman left too long is a lost
 * score, not one that waits to be shot. Ages are game seconds since the rider first had it in sight (a pause holds them).
 */
export const SNOW_SINK = {
  near: 1300,
  /** Cosine off the rider's look within which it counts as seen. */
  seenCos: 0.7,
  linger: 5,
  sinkS: 0.8,
  /** Past the tallest (the brute, ~1.8x the snowman model) so it is under the snow when it goes. */
  depth: 220,
} as const

/** How far under its stance it has sunk: 0 while it stands, easing in so it slumps, then drops. */
export function snowSinkDepth(seen: number): number {
  const u = (seen - SNOW_SINK.linger) / SNOW_SINK.sinkS
  if (u <= 0) return 0
  return SNOW_SINK.depth * Math.min(1, u * u)
}

export function snowSunk(seen: number): boolean {
  return seen >= SNOW_SINK.linger + SNOW_SINK.sinkS
}
