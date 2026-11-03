import type { TrackIndex } from '@/levels/environments/shared/trackClearance'

/** The Giant Scorpion's motion, pure and allocation-free per frame. Local frame: +z its head, +y up, +x its left. */

export const SCORPION_BODY = {
  /** [y, z] */
  tailBase: [118, -285] as const,
  /** +x side, mirrored on −x, front to back. */
  hips: [
    [120, 80, 175],
    [130, 80, 85],
    [130, 80, -5],
    [120, 80, -95],
  ] as const,
  /** At rest, [x, z]. */
  feet: [
    [225, 280],
    [250, 120],
    [250, -65],
    [225, -215],
  ] as const,
  kneeRise: 70,
  femurRadius: 17,
  tibiaRadius: 12,
  /** +x arm; `claw` is the palm centre at rest. */
  shoulder: [95, 95, 250] as const,
  elbow: [235, 140, 310] as const,
  claw: [205, 105, 440] as const,
  clawYaw: 0.18,
  wristBack: 75,
  armRadius: 26,
} as const

export const SCORPION_TAIL = {
  segments: 4,
  segLen: 110,
  radii: [46, 42, 38, 34] as const,
  /** Radians from vertical towards the head. */
  rest: [-0.6, -0.05, 0.55, 1.15] as const,
  stingerBend: 0.75,
  lunge: [0.75, 0.55, 0.35, 0.2] as const,
  stingerLunge: 0.5,
  windup: -0.35,
  sway: 0.06,
} as const

export const SCORPION_LUNGE = {
  first: 2.2,
  period: 4,
  windupS: 0.55,
  strikeS: 0.2,
  holdS: 0.3,
  recoverS: 0.9,
} as const

export const LUNGE_IMPACT_S = SCORPION_LUNGE.windupS + SCORPION_LUNGE.strikeS

const GAIT = {
  step: 45,
  lift: 50,
  stride: 180,
  /** Cycles per second standing still: it never stops scuttling. */
  idleHz: 0.6,
} as const

export const SCORPION_RISE = {
  /** Below its ~480-tall tail. */
  depth: 560,
  riseS: 1.4,
  sinkS: 1.5,
} as const

/** [ahead, side] of the rider in preference order, on either side: the track loops over most of the sand ahead. */
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
  /** Body and legs; the claws and tail may reach past a tower. */
  footprint: 260,
  clearance: 45,
} as const

interface Circle {
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
  forwardX: number
  forwardZ: number
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

/** Keeps `out`'s slot and side while clear, so it doesn't hop about; false (and `out` unchanged) if all are blocked. */
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

/** Overshoots past 1 and settles: a burst, not a lift. */
const erupt = (x: number) => {
  const t = Math.min(1, Math.max(0, x))
  const c = 1.7
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2
}

export function riseOffset(age: number, sinceDefeat: number): number {
  const R = SCORPION_RISE
  const up = erupt(age / R.riseS)
  const down = sinceDefeat < 0 ? 0 : smooth(sinceDefeat / R.sinkS)
  return -R.depth * (1 - up) - R.depth * down
}

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

/** (prev, now] */
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
  count: number
  /** Joints from the base; index `count` is the stinger's. */
  y: Float32Array
  z: Float32Array
  theta: Float32Array
}

export function createTailPose(): TailPose {
  const n = SCORPION_TAIL.segments + 1
  return { count: 0, y: new Float32Array(n + 1), z: new Float32Array(n + 1), theta: new Float32Array(n) }
}

/** Only the `live` segments, closed up from the base, so a broken one shortens the tail; then the stinger. */
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
  out.theta[live] = (live > 0 ? theta + T.stingerBend : 0.3) + lunge * T.stingerLunge
  return out
}

export interface FootStep {
  dz: number
  lift: number
}

/** Alternating tetrapod: legs 0 and 2 on +x step with 1 and 3 on −x. */
export function footStep(out: FootStep, phase: number, leg: number, side: 1 | -1): FootStep {
  const G = GAIT
  const group = (leg + (side > 0 ? 0 : 1)) % 2
  const u = phase + group * Math.PI
  out.dz = -Math.cos(u) * G.step
  out.lift = Math.max(0, Math.sin(u)) * G.lift
  return out
}

/** Gait phase after moving `dist` in `dt` seconds. */
export function advanceGait(phase: number, dist: number, dt: number): number {
  const G = GAIT
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
