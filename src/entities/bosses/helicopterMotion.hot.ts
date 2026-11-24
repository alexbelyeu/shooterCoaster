import { clamp01, smooth } from './bossCycle.hot'

/**
 * The Helicopter's motion (Neon Metropolis's finale, #325), pure and on game time so a test can sample it.
 * Local frame: +z is the nose, +y up. Distances are world units, angles radians.
 */
export const HELI = {
  /** Its anchor ahead of the rider on the rider's heading, above the camera, and never lower than this over the street. */
  ahead: 560,
  above: 90,
  minClearance: 240,
  /** It weaves across the street ahead, `side` either way, one sweep every `2π / weaveRate` s. */
  side: 150,
  weaveRate: 0.35,
  followTau: 1,
  /** It drops in from `dropIn` above its anchor over `dropSeconds` (the tell's beam comes from up there). */
  dropIn: 260,
  dropSeconds: 1.6,
  /** Turned off facing the rider so its side (the tail rotor) shows: a three-quarter view. */
  quarter: 0.65,
  /** Rotor spins, radians a second. */
  mainRotor: 22,
  tailRotor: 40,
} as const

/** The searchlight's spot on the street, from the camera along the rider's heading: ahead, swept across it. */
export const BEAM = {
  ahead: 300,
  aheadSwing: 70,
  side: 130,
  /** The sweep across and the swing along, radians a second. */
  sweepRate: 1.2,
  swingRate: 0.7,
  /** During the tell the spot comes in from this far off to the side, out of the frame. */
  tellSide: 900,
} as const

/** Losing its tail rotor: it yaws back and forth, as a real one would spin. */
export const TAIL_LOST_WOBBLE = { amplitude: 0.45, rate: 2.6 } as const

/** Its defeat: it spins up and falls into the street, trailing smoke. */
export const HELI_FALL = {
  /** Spin, radians a second, reached after `spinRamp` s. */
  spin: 9,
  spinRamp: 0.8,
  gravity: 170,
  /** Nose-down pitch it tips to as it falls. */
  pitch: 0.55,
  exitSeconds: 3.5,
  /** A smoke puff off its tail every this many seconds. */
  smokeEvery: 0.45,
} as const

export interface HeliPose {
  /** Bob, added to its height. */
  dy: number
  pitch: number
  roll: number
  /** Yaw added to its facing (the quarter turn, the tail-lost wobble, the defeat's spin). */
  yaw: number
  /** How far it has fallen since its defeat. */
  drop: number
}

/** Extra height while it drops in after its arrival: `dropIn` at 0 s, eased to 0 by `dropSeconds`. */
export function dropInHeight(age: number): number {
  return HELI.dropIn * (1 - smooth(clamp01(age / HELI.dropSeconds)))
}

/** The angle it has spun through `t` s after its defeat: the rate ramps up linearly, then holds. */
export function fallSpin(t: number): number {
  if (t <= 0) return 0
  const { spin, spinRamp } = HELI_FALL
  if (t < spinRamp) return (spin * t * t) / (2 * spinRamp)
  return spin * (t - spinRamp / 2)
}

/** How far it has fallen `t` s after its defeat. */
export function fallDrop(t: number): number {
  return t <= 0 ? 0 : 0.5 * HELI_FALL.gravity * t * t
}

/**
 * Its pose at `age` s of its fight: a slow bob, a nose-down tilt that breathes and a lazy bank; without its tail rotor
 * a yaw wobble; `sinceDefeat` ≥ 0 its spin and fall (-1 while it fights).
 */
export function heliPose(out: HeliPose, age: number, tailLost: boolean, sinceDefeat: number): HeliPose {
  out.dy = Math.sin(age * 1.1) * 12 + Math.sin(age * 2.3 + 1) * 4
  out.pitch = 0.1 + Math.sin(age * 0.8) * 0.06
  out.roll = Math.sin(age * 0.55 + 1) * 0.08
  out.yaw = HELI.quarter * Math.sin(age * 0.25 + 0.6)
  if (tailLost) {
    const { amplitude, rate } = TAIL_LOST_WOBBLE
    out.yaw += amplitude * Math.sin(age * rate) + 0.3 * amplitude * Math.sin(age * rate * 2.1 + 0.7)
    out.roll += 0.06 * Math.sin(age * rate * 1.3)
  }
  out.drop = 0
  if (sinceDefeat >= 0) {
    out.yaw += fallSpin(sinceDefeat)
    out.pitch += (HELI_FALL.pitch - out.pitch) * clamp01(sinceDefeat / 1.2)
    out.drop = fallDrop(sinceDefeat)
  }
  return out
}

export interface BeamSpot {
  /** Along the rider's heading from the camera. */
  ahead: number
  /** Across it, to the rider's right. */
  side: number
}

/**
 * The searchlight's spot `t` s into the sweep: on the street ahead, swept across the track and swinging along it.
 * `tell` (0 → 1 over the boss's tell) brings it in from off the side of the frame; 1 once it has arrived.
 */
export function beamSpot(out: BeamSpot, t: number, tell = 1): BeamSpot {
  out.ahead = BEAM.ahead + BEAM.aheadSwing * Math.sin(t * BEAM.swingRate)
  out.side = BEAM.side * Math.sin(t * BEAM.sweepRate) + BEAM.tellSide * (1 - smooth(clamp01(tell)))
  return out
}
