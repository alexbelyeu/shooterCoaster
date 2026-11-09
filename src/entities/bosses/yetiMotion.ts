import type { PerchConfig } from './scorpionMotion'

/** The Yeti's motion, pure and allocation-free per frame. Local frame: +z faces the rider, +y up, +x its left. */

export const YETI_BODY = {
  shoulder: [215, 680, 0] as const,
  /** +x side (mirrored): hanging, raised in a roar, wound up behind its head, thrown forward. */
  fistRest: [300, 330, 90] as const,
  fistRoar: [360, 860, 40] as const,
  fistBack: [170, 900, -150] as const,
  fistForward: [180, 640, 300] as const,
  elbowOut: 70,
  elbowBack: 50,
  upperArmRadius: 62,
  forearmRadius: 56,
  head: [0, 790, 20] as const,
  roarTilt: 0.45,
  chest: [0, 560, 150] as const,
} as const

/** Every roar exposes the chest (phase 1) and flares the aurora; the first comes as it arrives. */
export const YETI_ROAR = {
  first: 0.6,
  roarS: 2.2,
  period: 7.5,
  rampS: 0.35,
} as const

export const YETI_THROW = {
  windupS: 0.55,
  followS: 0.6,
  gapS: 0.7,
  flightS: 2.4,
  arc: 240,
  /** Passes the camera this far to the side (alternating) and below. */
  side: 95,
  drop: 15,
  /** Fraction of a flight it keeps going past the camera. */
  overshoot: 0.12,
  pool: 8,
} as const

export const THROW_S = YETI_THROW.windupS + YETI_THROW.followS

export const YETI_RISE = {
  /** More than its ~900 height: it climbs up from behind the ridge. */
  depth: 950,
  riseS: 1.2,
  toppleS: 1.3,
  sinkS: 0.9,
  sinkDepth: 260,
} as const

/** Holds a ridge until the rider is about to pass it (or `holdS`), then lopes to the next. */
export const YETI_ROAM = {
  holdS: 10,
  lopeS: 1.6,
  hops: 3,
  hopHeight: 70,
  minAhead: 520,
  maxOffAngle: 1.05,
} as const

export const YETI_PERCH: PerchConfig = {
  slots: [
    [1150, 520],
    [1300, 460],
    [1050, 640],
    [1450, 560],
    [980, 500],
    [1250, 760],
    [1600, 480],
    [1100, 860],
  ],
  footprint: 230,
  clearance: 45,
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smooth = (x: number) => {
  const t = clamp01(x)
  return t * t * (3 - 2 * t)
}

/** Negative before the first roar. */
function roarCycle(t: number): number {
  const u = t - YETI_ROAR.first
  return u < 0 ? u : u % YETI_ROAR.period
}

export function isRoaring(t: number): boolean {
  const u = roarCycle(t)
  return u >= 0 && u < YETI_ROAR.roarS
}

/** 0..1: arms up, head back, chest open. */
export function roarAmount(t: number): number {
  const u = roarCycle(t)
  if (u < 0 || u >= YETI_ROAR.roarS) return 0
  const R = YETI_ROAR
  return Math.min(smooth(u / R.rampS), smooth((R.roarS - u) / R.rampS))
}

export function timeToNextRoar(t: number): number {
  const u = roarCycle(t)
  if (u < 0) return -u
  return u < YETI_ROAR.roarS ? 0 : YETI_ROAR.period - u
}

/** When it loses its last fist it roars at once. */
export function roarNowEpoch(now: number): number {
  return now - YETI_ROAR.first
}

/** Never retracted before the last phase (its phase hides it), so the hit that breaks the last fist exposes it in the same turn. */
export function chestRetracted(lastPhase: boolean, roarT: number): boolean {
  return lastPhase && !isRoaring(roarT)
}

export function throwArmAlive(preferred: number, leftAlive: boolean, rightAlive: boolean): number {
  const alive = (arm: number) => (arm === 0 ? leftAlive : rightAlive)
  if (alive(preferred)) return preferred
  if (alive(1 - preferred)) return 1 - preferred
  return -1
}

/** −1 wound up behind the head … 0 rest … +1 thrown forward. */
export function throwSwing(u: number): number {
  const T = YETI_THROW
  if (u <= 0 || u >= THROW_S) return 0
  if (u < T.windupS) return -smooth(u / (T.windupS * 0.8))
  const v = (u - T.windupS) / T.followS
  return v < 0.25 ? -1 + 2 * smooth(v / 0.25) : 1 - smooth((v - 0.25) / 0.75)
}

export interface Point3 {
  x: number
  y: number
  z: number
}

/** Root-local; `side` +1 is its left. */
export function fistPose(out: Point3, side: 1 | -1, roar: number, swing: number, age: number): Point3 {
  const B = YETI_BODY
  const sway = Math.sin(age * 1.4 + (side > 0 ? 0 : 1.7))
  let x = B.fistRest[0] + sway * 12
  let y = B.fistRest[1] + sway * 18
  let z = B.fistRest[2]
  const pose = swing < 0 ? B.fistBack : B.fistForward
  const k = Math.abs(swing)
  x += (pose[0] - x) * k
  y += (pose[1] - y) * k
  z += (pose[2] - z) * k
  x += (B.fistRoar[0] - x) * roar
  y += (B.fistRoar[1] - y) * roar
  z += (B.fistRoar[2] - z) * roar
  out.x = side * x
  out.y = y
  out.z = z
  return out
}

export function elbowPose(out: Point3, side: 1 | -1, fist: Point3): Point3 {
  const B = YETI_BODY
  out.x = (side * B.shoulder[0] + fist.x) / 2 + side * B.elbowOut
  out.y = (B.shoulder[1] + fist.y) / 2
  out.z = (B.shoulder[2] + fist.z) / 2 - B.elbowBack
  return out
}

/** Overshoots past the ridge line and settles: it hauls itself up. */
export function riseOffset(age: number): number {
  const t = clamp01(age / YETI_RISE.riseS)
  const c = 1.4
  const up = 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2
  return -YETI_RISE.depth * (1 - up)
}

export function toppleAngle(sinceDefeat: number): number {
  if (sinceDefeat < 0) return 0
  const t = clamp01(sinceDefeat / YETI_RISE.toppleS)
  return -(Math.PI / 2) * 0.92 * t * t
}

export function toppleSink(sinceDefeat: number): number {
  return -YETI_RISE.sinkDepth * smooth((sinceDefeat - YETI_RISE.toppleS) / YETI_RISE.sinkS)
}

/** Held its ridge long enough, the rider is about to pass it, or it is off to the side of the view. */
export function needsRelocate(holdAge: number, ahead: number, side: number): boolean {
  const R = YETI_ROAM
  return holdAge >= R.holdS || ahead < R.minAhead || Math.abs(Math.atan2(side, ahead)) > R.maxOffAngle
}

export interface Lope {
  t: number
  lift: number
}

export function lopeAt(out: Lope, u: number): Lope {
  const R = YETI_ROAM
  const s = clamp01(u / R.lopeS)
  out.t = smooth(s)
  out.lift = Math.abs(Math.sin(s * Math.PI * R.hops)) * R.hopHeight
  return out
}

/** Past `s` = 1 it keeps going the same way. */
export function snowballAt(out: Point3, from: Point3, to: Point3, s: number): Point3 {
  out.x = from.x + (to.x - from.x) * s
  out.y = from.y + (to.y - from.y) * s + 4 * YETI_THROW.arc * s * (1 - s)
  out.z = from.z + (to.z - from.z) * s
  return out
}

export function passedCamera(prevS: number, s: number): boolean {
  return prevS < 1 && s >= 1
}
