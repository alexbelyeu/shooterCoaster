/** Ocean prop dimensions at scale 1, shared by the geometry builders and the placement (pure). */

/** One horizontal ring of a rock: height, radius, centre offset. */
export interface RockRing {
  y: number
  r: number
  ox?: number
  oz?: number
}

/** Outer radius of a ring profile at height `y` (linear between rings, ignoring jitter). */
export function profileRadiusAt(rings: readonly RockRing[], y: number): number {
  if (y <= rings[0].y) return rings[0].r
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i]
    const b = rings[i + 1]
    if (y <= b.y && b.y > a.y) return a.r + ((b.r - a.r) * (y - a.y)) / (b.y - a.y)
  }
  return rings[rings.length - 1].r
}

// Sea stack: three eroded tiers with ledges between them (same y, smaller ring).
export const STACK_RINGS: readonly RockRing[] = [
  { y: 0, r: 44 },
  { y: 72, r: 39 },
  { y: 72, r: 33, ox: 3 },
  { y: 140, r: 29, ox: 5, oz: -2 },
  { y: 140, r: 25, ox: 6, oz: -3 },
  { y: 196, r: 21, ox: 7, oz: -2 },
  { y: 196, r: 17, ox: 8, oz: -1 },
  { y: 226, r: 13, ox: 9 },
]
export const STACK_CAP_RISE = 6
export const STACK_FOOTPRINT = 44
export const STACK_HEIGHT = 226 + STACK_CAP_RISE

export const ROCK_RINGS: readonly RockRing[] = [
  { y: 0, r: 15 },
  { y: 22, r: 14, ox: 1 },
  { y: 40, r: 11, ox: 2, oz: 1 },
  { y: 52, r: 7, ox: 3, oz: 1 },
]
export const ROCK_CAP_RISE = 4
export const ROCK_FOOTPRINT = 15
export const ROCK_HEIGHT = 52 + ROCK_CAP_RISE

export const KELP_HEIGHT = 30
