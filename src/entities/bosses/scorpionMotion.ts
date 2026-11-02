import type { TrackIndex } from '@/levels/environments/shared/trackClearance'

/**
 * The Giant Scorpion's motion, pure and allocation-free per frame. Local frame: +z towards its
 * head, +y up, ±x its sides; the root stands on the sand under the middle of its body.
 */

export const SCORPION_BODY = {
  /** Where the tail leaves the body, [y, z]. */
  tailBase: [118, -285] as const,
  /** Hip [x, y, z] of the four legs on the +x side (mirrored on −x), front to back. */
  hips: [
    [120, 80, 175],
    [130, 80, 85],
    [130, 80, -5],
    [120, 80, -95],
  ] as const,
  /** Foot at rest [x, z], same order. */
  feet: [
    [225, 280],
    [250, 120],
    [250, -65],
    [225, -215],
  ] as const,
  /** Knees ride this high above the higher end of the leg. */
  kneeRise: 70,
  femurRadius: 17,
  tibiaRadius: 12,
  /** Arm on the +x side: shoulder and elbow [x, y, z]; the claw's palm centre at rest. */
  shoulder: [95, 95, 250] as const,
  elbow: [235, 140, 310] as const,
  claw: [205, 105, 440] as const,
  /** Claw yaw outwards on its side, radians. */
  clawYaw: 0.18,
  /** Wrist: this far behind the palm centre along the claw. */
  wristBack: 75,
  armRadius: 26,
} as const

export const SCORPION_TAIL = {
  segments: 4,
  segLen: 110,
  /** Each segment's radius, base to tip. */
  radii: [46, 42, 38, 34] as const,
  /** At rest, radians from vertical towards +z (the head): back, up, then curling over. */
  rest: [-0.6, -0.05, 0.55, 1.15] as const,
  /** The stinger hangs this much further over than the last segment left on the tail. */
  stingerBend: 0.75,
  /** Added at the peak of a lunge: the tail swings forward over the body at the rider. */
  lunge: [0.75, 0.55, 0.35, 0.2] as const,
  stingerLunge: 0.5,
  /** Wind-up: fraction of the lunge pulled back the other way. */
  windup: -0.35,
  sway: 0.06,
} as const

/** A lunge every `period` s from `first` s after it arrives: wind up, strike, hold, recover. */
export const SCORPION_LUNGE = {
  first: 2.2,
  period: 4,
  windupS: 0.55,
  strikeS: 0.2,
  holdS: 0.3,
  recoverS: 0.9,
} as const

/** Seconds into a lunge cycle when the strike lands (camera trauma + dust). */
export const LUNGE_IMPACT_S = SCORPION_LUNGE.windupS + SCORPION_LUNGE.strikeS

export const SCORPION_GAIT = {
  /** Foot travel along z either side of rest, and its lift while swinging. */
  step: 45,
  lift: 50,
  /** Ground covered per gait cycle. */
  stride: 180,
  /** Cycles per second while standing still, so it always scuttles. */
  idleHz: 0.6,
} as const

export const SCORPION_RISE = {
  /** Fully under the sand (its tail is ~480 tall). */
  depth: 560,
  riseS: 1.4,
  /** Defeated: collapses into the sand. */
  sinkS: 1.5,
} as const

/**
 * Where it rides relative to the rider: [ahead, side] in preference order, on either side.
 * The first slot is the usual one; the others are fallbacks when the track or a landmark is in the way.
 */
export const PERCH = {
  slots: [
    [900, 420],
    [1020, 360],
    [820, 520],
    [1150, 480],
    [780, 380],
    [1000, 640],
    [1250, 380],
    [860, 760],
    [1300, 680],
    [740, 600],
  ] as const,
  /** Its body and legs, XZ; claws and tail may reach a little past a tower. */
  footprint: 260,
  /** Kept off the rails and the towers under them. */
  clearance: 45,
} as const

export interface Circle {
  x: number
  z: number
  r: number
}

export interface Perch {
  x: number
  z: number
  slot: number
  sign: 1 | -1
}

export interface PerchInput {
  index: TrackIndex
  camera: { x: number; z: number }
  /** Unit horizontal heading it rides along. */
  forwardX: number
  forwardZ: number
  /** Landmarks and mesas. */
  avoid: readonly Circle[]
}

export function perchClear(input: PerchInput, x: number, z: number): boolean {
  if (input.index.near(x, z, PERCH.clearance + PERCH.footprint)) return false
  for (const a of input.avoid) if (Math.hypot(a.x - x, a.z - z) < a.r + PERCH.footprint) return false
  return true
}

function slotAt(input: PerchInput, slot: number, sign: number, out: { x: number; z: number }): void {
  const [ahead, side] = PERCH.slots[slot]
  // Right of the heading is (−fz, fx).
  out.x = input.camera.x + input.forwardX * ahead - input.forwardZ * side * sign
  out.z = input.camera.z + input.forwardZ * ahead + input.forwardX * side * sign
}

const _at = { x: 0, z: 0 }

/**
 * A clear spot ahead of the rider, keeping `out`'s current slot and side while they stay clear, so
 * it doesn't hop about. False (and `out` unchanged) if every slot is blocked.
 */
export function pickPerch(out: Perch, input: PerchInput): boolean {
  const n = PERCH.slots.length
  for (let s = 0; s < 2; s++) {
    const sign = s === 0 ? out.sign : (-out.sign as 1 | -1)
    for (let k = 0; k < n; k++) {
      const slot = s === 0 ? (out.slot + k) % n : k
      slotAt(input, slot, sign, _at)
      if (!perchClear(input, _at.x, _at.z)) continue
      out.x = _at.x
      out.z = _at.z
      out.slot = slot
      out.sign = sign
      return true
    }
  }
  return false
}

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x))
  return t * t * (3 - 2 * t)
}

/** Overshoots past 1 and settles: it bursts out of the sand rather than lifting. */
const erupt = (x: number) => {
  const t = Math.min(1, Math.max(0, x))
  const c = 1.7
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2
}

/** Height of the root under its resting place: rising out of the sand, then collapsing into it once defeated. */
export function riseOffset(age: number, sinceDefeat: number): number {
  const R = SCORPION_RISE
  const up = erupt(age / R.riseS)
  const down = sinceDefeat < 0 ? 0 : smooth(sinceDefeat / R.sinkS)
  return -R.depth * (1 - up) - R.depth * down
}

/** −windup … 1: how far into its lunge the tail is, `age` s after it arrived. */
export function lungeAmount(age: number): number {
  const L = SCORPION_LUNGE
  const t = age - L.first
  if (t < 0) return 0
  const u = t % L.period
  if (u < L.windupS) return SCORPION_TAIL.windup * smooth(u / L.windupS)
  const v = u - L.windupS
  if (v < L.strikeS) return SCORPION_TAIL.windup + (1 - SCORPION_TAIL.windup) * smooth(v / L.strikeS)
  const w = v - L.strikeS
  if (w < L.holdS) return 1
  return 1 - smooth((w - L.holdS) / L.recoverS)
}

/** True if a strike landed in (prev, now]. */
export function lungeImpactBetween(prev: number, now: number): boolean {
  const L = SCORPION_LUNGE
  if (now <= prev) return false
  const first = L.first + LUNGE_IMPACT_S
  if (now < first) return false
  const k = Math.floor((now - first) / L.period)
  const at = first + k * L.period
  return at > prev
}

export interface TailPose {
  /** Segments laid (live ones only, closed up from the base). */
  count: number
  /** Joints from the base: y, z (local) and the angle from vertical of the piece starting there; index `count` is the stinger. */
  y: Float32Array
  z: Float32Array
  theta: Float32Array
}

export function createTailPose(): TailPose {
  const n = SCORPION_TAIL.segments + 1
  return { count: 0, y: new Float32Array(n + 1), z: new Float32Array(n + 1), theta: new Float32Array(n) }
}

/**
 * Lays `live` segments from the base (a broken one is gone and the rest close up, so the tail
 * gets shorter), then the stinger. `lunge` from `lungeAmount`; `sway` a small idle wave (radians).
 */
export function layTail(out: TailPose, live: number, lunge: number, sway: number): TailPose {
  const T = SCORPION_TAIL
  const [baseY, baseZ] = SCORPION_BODY.tailBase
  out.count = live
  out.y[0] = baseY
  out.z[0] = baseZ
  let theta = 0
  for (let k = 0; k < live; k++) {
    theta = T.rest[k] + lunge * T.lunge[k] + sway * (k + 1) * 0.5
    out.theta[k] = theta
    out.y[k + 1] = out.y[k] + Math.cos(theta) * T.segLen
    out.z[k + 1] = out.z[k] + Math.sin(theta) * T.segLen
  }
  // A bare stub still holds the stinger up, pointing over the back.
  out.theta[live] = (live > 0 ? theta + T.stingerBend : 0.3) + lunge * T.stingerLunge
  return out
}

/** Tail tip height above the sand (stinger base), for tests and checks. */
export function tailTopY(pose: TailPose): number {
  return pose.y[pose.count]
}

export interface FootStep {
  /** Along local z from the foot's rest. */
  dz: number
  lift: number
}

/** Alternating tetrapod gait: legs 0 and 2 on +x step with 1 and 3 on −x. Stance feet sit on the sand. */
export function footStep(out: FootStep, phase: number, leg: number, side: 1 | -1): FootStep {
  const G = SCORPION_GAIT
  const group = (leg + (side > 0 ? 0 : 1)) % 2
  const u = phase + group * Math.PI
  out.dz = -Math.cos(u) * G.step
  out.lift = Math.max(0, Math.sin(u)) * G.lift
  return out
}

/** Gait phase after moving `dist` in `dt` seconds. */
export function advanceGait(phase: number, dist: number, dt: number): number {
  const G = SCORPION_GAIT
  return (phase + (dist / G.stride + dt * G.idleHz) * Math.PI * 2) % (Math.PI * 1e4)
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

/** It looks at the rider, turned `blend` of the way to the way it rides: a three-quarter view of claws and tail. */
export function faceYaw(yawToRider: number, yawHeading: number, blend: number): number {
  return yawToRider + wrap(yawHeading - yawToRider) * blend
}

/** `current` turned `k` (0..1) of the shortest way to `target`. */
export function approachAngle(current: number, target: number, k: number): number {
  return current + wrap(target - current) * k
}
