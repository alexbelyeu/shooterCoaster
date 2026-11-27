/**
 * Level 1's balloons on the wind (#1059): each sways across its spot and rises, and once the rider has it in sight
 * (within `near`, ahead of its look) it lingers `linger` s, then slips away upward, gone `flyOff` s later. A balloon left
 * too long is a lost score, not one that waits to be shot. Ages are game seconds (a pause holds them): the sway's since
 * it settled in its spot, the lift's and the escape's since the rider first had it in sight.
 */
export const BALLOON_FLIGHT = {
  /** Units a second a free balloon rises and drifts back along z while it lingers. */
  rise: 18,
  drift: 12,
  /** Side-to-side sway: half-width in units, radians a second. */
  sway: 45,
  swayRate: 1.3,
  /** Seen from this far: further than the balloons a player pops first, so the far ones of a wave slip away unpopped. */
  near: 2000,
  /** Cosine off the rider's look within which it counts as seen. */
  seenCos: 0.7,
  linger: 3.5,
  /** Units a second² it climbs once it lets go. */
  climb: 160,
  flyOff: 2.5,
} as const

/** Sideways offset from its spot, 0 as it settles so it never jumps. */
export function balloonSway(age: number, phase: number): number {
  const { sway, swayRate } = BALLOON_FLIGHT
  return sway * (Math.sin(age * swayRate + phase) - Math.sin(phase))
}

/** Extra height since it let go: 0 while it lingers. */
export function balloonLift(age: number): number {
  const t = age - BALLOON_FLIGHT.linger
  return t > 0 ? 0.5 * BALLOON_FLIGHT.climb * t * t : 0
}

export function balloonEscaped(age: number): boolean {
  return age >= BALLOON_FLIGHT.linger + BALLOON_FLIGHT.flyOff
}
