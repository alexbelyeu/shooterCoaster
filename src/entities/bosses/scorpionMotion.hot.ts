import type { TrackIndex } from '@/levels/environments/shared/trackClearance'
import { inWindow, smooth, type ExposureWindow } from './bossCycle.hot'

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

/** Each lunge, from its windup to the end of its recovery. */
export const STRIKE_WINDOW: ExposureWindow = {
  first: SCORPION_LUNGE.first,
  period: SCORPION_LUNGE.period,
  openS: LUNGE_IMPACT_S + SCORPION_LUNGE.holdS + SCORPION_LUNGE.recoverS,
  rampS: 0.2,
}

/**
 * It fights back (#1059): its tail takes hits only while it strikes, and its claws only between strikes (raised to guard
 * while it does), so the rider shoots each in its moment and never the whole of it at once. A part never shuts when it is
 * all that is left to shoot (`othersLive` false: the other group is broken; the stinger, alone on the bare stub), or the
 * rider would have nothing to shoot half the fight.
 */
export function scorpionShut(id: string, age: number, othersLive: boolean): boolean {
  if (id === 'stinger' || !othersLive) return false
  const striking = inWindow(STRIKE_WINDOW, age)
  return id.startsWith('claw') ? striking : !striking
}

/** `scorpionShut` for weak point `i` of `wps`, with `hp` the hits each has left: whether the other group is live, read off `hp`. */
export function scorpionPartShut(wps: readonly { id: string }[], hp: ArrayLike<number>, i: number, age: number): boolean {
  const claw = wps[i].id.startsWith('claw')
  let othersLive = false
  for (let j = 0; j < wps.length && !othersLive; j++) {
    othersLive = hp[j] > 0 && wps[j].id !== 'stinger' && wps[j].id.startsWith('claw') !== claw
  }
  return scorpionShut(wps[i].id, age, othersLive)
}

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
  riseS: 0.9,
  sinkS: 1.5,
} as const

/** Where a ground boss may stand: [ahead, side] of the rider in preference order, on either side, and its footprint. */
export interface PerchConfig {
  slots: readonly (readonly [number, number])[]
  footprint: number
  clearance: number
}

/** [ahead, side] of the rider in preference order, on either side: the track loops over most of the sand ahead. */
export const PERCH: PerchConfig = {
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
  ],
  /** Body and legs; the claws and tail may reach past a tower. */
  footprint: 260,
  clearance: 45,
}

/** For the scuttle back into the frame (`pickSeenPerch`): `PERCH`'s slots, then farther ones for a view pitched up a lift,
 * where the nearer sand is under the frame (#937), and nearer ones for the bare stub, in front of a dune that hides the
 * farther sand from a rider low in a valley (#1059: level 2's final lift). Never in `pickPerch`'s fallback: a normal fight
 * keeps to its own sand. */
export const SEEN_PERCH: PerchConfig = {
  ...PERCH,
  slots: [...PERCH.slots, [1600, 420], [2000, 560], [2400, 700], [480, 300], [560, 160], [420, 460]],
}

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
  /** When set, `pickPerch` prefers a slot the rider can see (the terrain between them clear) over a hidden one. */
  seen?: (x: number, z: number) => boolean
}

/** The perch is behind the rider's look (#937: a held far slot the ride has passed gives way to `pickPerch`). */
export function perchBehind(perch: Perch, input: PerchInput): boolean {
  return (perch.x - input.camera.x) * input.forwardX + (perch.z - input.camera.z) * input.forwardZ < 0
}

export function perchClear(input: PerchInput, x: number, z: number, config: PerchConfig = PERCH): boolean {
  if (input.index.near(x, z, config.clearance + config.footprint)) return false
  for (const a of input.avoid) if (Math.hypot(a.x - x, a.z - z) < a.r + config.footprint) return false
  return true
}

function slotAt(input: PerchInput, config: PerchConfig, slot: number, sign: number, out: { x: number; z: number }): void {
  const [ahead, side] = config.slots[slot]
  // Right of the heading is (−fz, fx).
  out.x = input.camera.x + input.forwardX * ahead - input.forwardZ * side * sign
  out.z = input.camera.z + input.forwardZ * ahead + input.forwardX * side * sign
}

const _at = { x: 0, z: 0 }

/** Turning less than this (the sine between the eased heading and the look) reads as straight. */
const TURNING = 0.02
/** How far ahead of the look to lay its slots, as a share of the eased heading's lag behind it (`HEADING_TAU`, 2.5 s:
 * half is the turn ~1.2 s on), and at most (radians). */
const LEAD_SHARE = 0.5
const LEAD_MAX = 0.6

/**
 * Where to lay its slots when it bursts out again in a turn (#1059: level 2's final turn): the look (`x`, `z`) turned on
 * towards where it is turning, from its eased heading (`lagX`, `lagZ`) behind it, into `out`, with `out.sign` the side
 * it turns to (1 right, −1 left; `current` while it runs straight). A perch laid ahead of the turn and on its inside
 * swings into the middle of the frame as the car comes round, where one laid on the look as it is leaves it in a second.
 */
export function leadLook(out: { x: number; z: number; sign: 1 | -1 }, lagX: number, lagZ: number, x: number, z: number, current: 1 | -1): void {
  // Right of a heading (fx, fz) is (−fz, fx).
  const right = -lagZ * x + lagX * z
  out.sign = right > TURNING ? 1 : right < -TURNING ? -1 : current
  const lead = Math.max(-LEAD_MAX, Math.min(LEAD_MAX, Math.atan2(right, lagX * x + lagZ * z) * LEAD_SHARE))
  const c = Math.cos(lead)
  const sn = Math.sin(lead)
  out.x = x * c - z * sn
  out.z = z * c + x * sn
}

/** Keeps `out`'s slot and side while clear (and seen, with `input.seen`), so it doesn't hop about; a clear slot the rider can't see only when none is seen; false (and `out` unchanged) if all are blocked. */
export function pickPerch(out: Perch, input: PerchInput, config: PerchConfig = PERCH): boolean {
  return (input.seen !== undefined && pickFrom(out, input, config, true)) || pickFrom(out, input, config, false)
}

/** Like `pickPerch`, but only a slot `input.seen` passes: false (and `out` unchanged) when none does. */
export function pickSeenPerch(out: Perch, input: PerchInput, config: PerchConfig = SEEN_PERCH): boolean {
  return pickFrom(out, input, config, true)
}

function pickFrom(out: Perch, input: PerchInput, config: PerchConfig, mustSee: boolean): boolean {
  const n = config.slots.length
  for (let s = 0; s < 2; s++) {
    const sign = s === 0 ? out.sign : (-out.sign as 1 | -1)
    for (let k = 0; k < n; k++) {
      const slot = s === 0 ? (out.slot + k) % n : k
      slotAt(input, config, slot, sign, _at)
      if (!perchClear(input, _at.x, _at.z, config)) continue
      if (mustSee && !input.seen!(_at.x, _at.z)) continue
      out.x = _at.x
      out.z = _at.z
      out.slot = slot
      out.sign = sign
      return true
    }
  }
  return false
}

/** Its first slot, clear or not: where it goes while no slot has been clear yet. */
export function firstSlot(out: { x: number; z: number }, input: PerchInput, config: PerchConfig = PERCH): void {
  slotAt(input, config, 0, 1, out)
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
  // eslint-disable-next-line sc/no-hot-path-alloc -- cold: once per boss mount, then laid in place
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
