import { clamp01, smooth, windowCycle } from './bossCycle.hot'
import { perchClear, type PerchConfig, type PerchInput } from './scorpionMotion.hot'

/** The Magma Titan's motion, pure and allocation-free per frame. Local frame: +z faces the rider, +y up, +x its left; feet at y 0. */

export const TITAN_BODY = {
  /** Arms hang from here (+x side, mirrored). */
  shoulder: [400, 1010, 0] as const,
  armLength: 760,
  head: [0, 1230, 110] as const,
  /** Weak points: the vents on its shoulders, the heart in its chest, the crown of lava on its head. */
  vent: [370, 1200, 10] as const,
  heart: [0, 860, 165] as const,
  crown: [0, 1385, 100] as const,
} as const

/** Every beat it pounds its chest and the plates part on the lava heart (`openS`); the first comes once it has risen. */
export const TITAN_BEAT = {
  first: 2.4,
  period: 5,
  /** The fists pound for this long at the start of the window, then hold the chest open. */
  poundS: 0.6,
  openS: 2.2,
  rampS: 0.3,
} as const

export const TITAN_RISE = {
  /** More than its ~1400 height: it climbs out of the lava from below. */
  depth: 1500,
  riseS: 2.2,
  /** Knee-deep in the lava, and on the rock once it wades out. */
  wadeDepth: 150,
} as const

/** Wades after the rider once it has fallen behind, too far off to the side or held `holdS`. */
export const TITAN_WADE = {
  holdS: 8,
  speed: 650,
  stride: 260,
  minAhead: 1000,
  maxOffAngle: 0.95,
  /** Sideways sway and bob per stride. */
  sway: 0.06,
  bob: 30,
} as const

/** Defeat: its glow dies to black, the cracks flash white once, then it bursts and the rest sinks. */
export const TITAN_DEFEAT = {
  darkS: 0.45,
  flashS: 0.35,
  sinkS: 1.6,
  sinkDepth: 900,
} as const

/** Where its break bursts on defeat, in its local frame: chest, shoulders, head. One explosion slot each. */
export const TITAN_BREAK_POINTS: readonly (readonly [number, number, number])[] = [[0, 820, 60], [300, 1050, 0], [-300, 1050, 0], [0, 1200, 30]]

export const TITAN_PERCH: PerchConfig = {
  slots: [
    [1650, 450],
    [1800, 380],
    [1550, 600],
    [1950, 500],
    [1450, 450],
    [1750, 750],
    [2100, 400],
    [1600, 850],
  ],
  footprint: 300,
  clearance: 50,
}

/** Rise spots on the lava rivers: this far ahead of the rider, at most `maxOff` radians off its heading. */
export const RIVER_SPOT = {
  minAhead: 1250,
  maxAhead: 2300,
  ideal: 1650,
  maxOff: 0.6,
} as const

/** 0 at rest … 1 fist on its chest: two pounds at the start of the window. */
export function poundAmount(t: number): number {
  const u = windowCycle(TITAN_BEAT, t)
  if (u < 0 || u >= TITAN_BEAT.poundS) return 0
  return Math.sin((u / TITAN_BEAT.poundS) * 2 * Math.PI) ** 2
}

/** Each pound's impact (the fists at the chest), for the thump and trauma. */
export function poundBetween(prev: number, now: number): boolean {
  const a = windowCycle(TITAN_BEAT, prev)
  const b = windowCycle(TITAN_BEAT, now)
  const q = TITAN_BEAT.poundS / 4
  return crossedInCycle(a, b, q) || crossedInCycle(a, b, 3 * q)
}

/**
 * Whether a weak point is shut at `t` on the beat (#1059): the heart shows only while the chest is open, and the vents choke
 * shut once the pounding fists have parted it (until the heart is out), so the rider tracks from its shoulders to its chest
 * and back. The crown never shuts.
 */
export function titanShut(id: string, t: number, heartLive: boolean): boolean {
  const u = windowCycle(TITAN_BEAT, t)
  if (id === 'heart') return !(u >= 0 && u < TITAN_BEAT.openS)
  if (id === 'crown') return false
  return heartLive && u >= TITAN_BEAT.poundS && u < TITAN_BEAT.openS
}

/** Whether the cycle position passed `at` going from `a` to `b` (b < a: wrapped into a new window). */
function crossedInCycle(a: number, b: number, at: number): boolean {
  return b < a ? b >= at : a < at && b >= at
}

/**
 * The cracks' heat from the boss's hp left (`hpFraction`): 0 = dull orange at full hp, 1 = white-hot at 10% and below.
 * Eased so the first hits already show.
 */
export function crackGlow(hpFraction: number): number {
  const t = clamp01((1 - hpFraction) / 0.9)
  return Math.sqrt(t)
}

/** Multiplies all its glow: 1 while it fights; on defeat down to black, one bright flash of the cracks, then dark as it sinks. */
export function defeatHeat(sinceDefeat: number): number {
  if (sinceDefeat < 0) return 1
  const { darkS, flashS } = TITAN_DEFEAT
  if (sinceDefeat < darkS) return 1 - smooth(sinceDefeat / darkS)
  const f = (sinceDefeat - darkS) / flashS
  return f < 1 ? 2.5 * Math.sin(f * Math.PI) : 0
}

/** Below the lava at first, climbing out over `riseS`. */
export function riseOffset(age: number): number {
  const t = smooth(age / TITAN_RISE.riseS)
  return -TITAN_RISE.depth * (1 - t) - TITAN_RISE.wadeDepth
}

export function defeatSink(sinceDefeat: number): number {
  if (sinceDefeat < 0) return 0
  const { darkS, flashS, sinkS, sinkDepth } = TITAN_DEFEAT
  return -sinkDepth * smooth((sinceDefeat - darkS - flashS) / sinkS)
}

export interface Point2 {
  x: number
  z: number
}

/** One step from `out` towards `to` at the wade speed; true once there. */
export function wadeStep(out: Point2, to: Point2, dt: number): boolean {
  const dx = to.x - out.x
  const dz = to.z - out.z
  const d = Math.hypot(dx, dz)
  const step = TITAN_WADE.speed * dt
  if (d <= step) {
    out.x = to.x
    out.z = to.z
    return true
  }
  out.x += (dx / d) * step
  out.z += (dz / d) * step
  return false
}

/** Its stride phase in radians from the distance waded: legs swing and the body sways on it. */
export function strideAngle(distance: number): number {
  return (distance / TITAN_WADE.stride) * Math.PI
}

/**
 * The lava river point to climb out of: ahead of the rider in its view, clear of the track and `input.avoid`, nearest the
 * ideal distance. False (and `out` unchanged) if none is.
 */
export function pickRiverSpot(out: Point2, input: PerchInput, river: readonly Point2[], config: PerchConfig = TITAN_PERCH): boolean {
  const { minAhead, maxAhead, ideal, maxOff } = RIVER_SPOT
  let best = Infinity
  for (const p of river) {
    const dx = p.x - input.camera.x
    const dz = p.z - input.camera.z
    const ahead = dx * input.forwardX + dz * input.forwardZ
    if (ahead < minAhead || ahead > maxAhead) continue
    const side = dz * input.forwardX - dx * input.forwardZ
    if (Math.abs(Math.atan2(side, ahead)) > maxOff) continue
    const cost = Math.abs(ahead - ideal) + Math.abs(side)
    if (cost >= best || !perchClear(input, p.x, p.z, config)) continue
    best = cost
    out.x = p.x
    out.z = p.z
  }
  return best < Infinity
}
