/**
 * Coaster camera weight (#123), rotation only: CoasterCamera applies it after `lookAt`
 * like the kill trauma, so the camera never leaves the track pose.
 * Accelerations are world units/s² ÷ trackScale; riding every level, lateral runs
 * ~10 / 130 / 300 at p50 / p90 / p99 and longitudinal ~20 / 150 / 250.
 */

import { distanceAtT, tAtLoopDistance, type ArcTable } from './arcLength'
import { smoothNoise1 } from '@/utils/valueNoise.hot'
import { smoothstep } from '@/utils/ease'

export interface Vec3Like {
  x: number
  y: number
  z: number
}

/** Bank / pitch (degrees) on the 'full' Screen-shake setting at tanh(1); a p90 turn banks ~5.5°. */
export const MAX_BANK_DEG = 8
export const MAX_PITCH_DEG = 3
/** A high-G turn banks up to this much more (×tanh³, so gentle turns keep their bank): a p99 turn ~12° (#697). */
export const HIGH_G_BANK_DEG = 5

/** Launch (#697): the shove into the seat tips the view up, then fades over ~2 s. */
export const LAUNCH_PITCH_DEG = 2
const LAUNCH_DECAY = 1.4
const LAUNCH_ATTACK = 10
/**
 * The longest step the launch takes per frame (#906): GO's frame is often a long one (the HUD mounts, the countdown
 * leaves), and one 0.9 s step decayed the shove to 0.28 before it was ever drawn. A slower frame plays it later instead.
 */
const LAUNCH_MAX_STEP = 0.1
/** Entering a steep drop the view dips (nose over) and recovers: the gap between a fast and a slow follower of the drop. */
export const DIP_DEG = 6
const DIP_FAST = 8
const DIP_SLOW = 1.5
/** Crest acceleration (units/s² ÷ trackScale; the levels' p5 runs -25 to -210) where the airtime float starts and is full. */
const AIRTIME_START = 30
const AIRTIME_FULL = 110
const AIRTIME_RESPONSE = 4
export const FLOAT_PITCH_DEG = 2
export const FLOAT_DRIFT_DEG = 1.5
const FLOAT_DRIFT_HZ = 0.6
const LIFT_RESPONSE = 6

/** The smoke's caps: every term at its peak. */
export const RIG_MAX_ROLL_DEG = MAX_BANK_DEG + HIGH_G_BANK_DEG + FLOAT_DRIFT_DEG
export const RIG_MAX_PITCH_DEG = MAX_PITCH_DEG + LAUNCH_PITCH_DEG + DIP_DEG + FLOAT_PITCH_DEG + FLOAT_DRIFT_DEG
/** Accelerations that give tanh(1) ≈ 76% of the peak. */
export const LATERAL_ACCEL_REF = 150
const LONGITUDINAL_ACCEL_REF = 200
/** Smoothing rates (1/s). */
export const BANK_RESPONSE = 4
const PITCH_RESPONSE = 3
export const LOOK_RESPONSE = 5
const SPEED_FOV_RESPONSE = 2
const DROP_RESPONSE = 3
/** Track descent (-tangent.y) where the drop FOV kick starts and where it is full (~6° and ~27° down). */
const DROP_START = 0.1
const DROP_FULL = 0.45

/** Distances along the track in world units × trackScale. */
export const LOOK_AHEAD_UNITS = 30
export const CURVATURE_SAMPLE_UNITS = 4
/** Share of the way from the tangent to the point ahead, capped so enemies stay in view. */
const LOOK_AHEAD_BLEND = 0.5
export const MAX_LOOK_AHEAD_DEG = 12

const DEG = Math.PI / 180

/** `1 - exp(-dt·rate)`: frame-rate independent. */
export function smoothingFactor(dt: number, rate: number): number {
  return dt > 0 ? 1 - Math.exp(-dt * rate) : 0
}

export function damp(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * smoothingFactor(dt, rate)
}

/** `rotateZ` radians toward the lateral acceleration along the camera's right axis. */
export function bankAngle(lateralAccel: number, trackScale: number): number {
  if (!Number.isFinite(lateralAccel)) return 0
  const u = Math.tanh(lateralAccel / (LATERAL_ACCEL_REF * trackScale))
  return -(MAX_BANK_DEG * u + HIGH_G_BANK_DEG * u * u * u) * DEG
}

/** `rotateX` radians: speeding up tips the view up, braking down. */
export function pitchAngle(longitudinalAccel: number, trackScale: number): number {
  if (!Number.isFinite(longitudinalAccel)) return 0
  return MAX_PITCH_DEG * DEG * Math.tanh(longitudinalAccel / (LONGITUDINAL_ACCEL_REF * trackScale))
}

/** 0 on the flat or climbing, easing to 1 on a steep drop. */
export function dropAmount(descent: number): number {
  if (!Number.isFinite(descent)) return 0
  return smoothstep((descent - DROP_START) / (DROP_FULL - DROP_START))
}


/** 0 off a crest, easing to 1 where it throws the rider up out of the seat. `verticalAccel` is negative over a crest. */
export function airtimeAmount(verticalAccel: number, trackScale: number): number {
  if (!Number.isFinite(verticalAccel) || !(trackScale > 0)) return 0
  return smoothstep((-verticalAccel / trackScale - AIRTIME_START) / (AIRTIME_FULL - AIRTIME_START))
}

/** What the camera reads off the ride each frame; one reused object. */
export interface RigInput {
  /** Units/s² along the camera's right axis (`lateralAcceleration`). */
  lateral: number
  /** Units/s² along the rails' up (`verticalAcceleration`): negative over a crest. */
  vertical: number
  /** Units/s. */
  speed: number
  /** 0 at the ride's minimum speed, 1 at its top. */
  speedNorm: number
  /** -tangent.y. */
  descent: number
  lifting: boolean
}

export interface RigState {
  /** Radians, before the Screen-shake scale (so Off is exactly 0 at once). */
  roll: number
  pitch: number
  speedNorm: number
  /** Smoothed `dropAmount`, 0–1. */
  drop: number
  lastSpeed: number | null
  /** The launch's shove: `launchDrive` jumps to 1 and decays, `launch` follows it in. */
  launchDrive: number
  launch: number
  dipFast: number
  dipSlow: number
  /** Smoothed `airtimeAmount`, 0–1. */
  airtime: number
  /** Smoothed `RigInput.lifting` (`ridePhysics.ts` `rideOnLift`), 0–1. */
  lift: number
  /** Game seconds, the float's drift clock. */
  time: number
}

/** Rig rotation before the Screen-shake scale (radians), from `rigAngles`. */
export interface RigAngles {
  pitch: number
  yaw: number
  roll: number
}

export function createRigState(): RigState {
  // eslint-disable-next-line sc/no-hot-path-alloc -- cold: once per camera mount
  return {
    roll: 0, pitch: 0, speedNorm: 0, drop: 0, lastSpeed: null,
    launchDrive: 0, launch: 0, dipFast: 0, dipSlow: 0, airtime: 0, lift: 0, time: 0,
  }
}

export function resetRig(state: RigState): RigState {
  state.roll = 0
  state.pitch = 0
  state.speedNorm = 0
  state.drop = 0
  state.lastSpeed = null
  state.launchDrive = 0
  state.launch = 0
  state.dipFast = 0
  state.dipSlow = 0
  state.airtime = 0
  state.lift = 0
  state.time = 0
  return state
}

/** The car leaves the station (GO), or a launch zone fires (#696). */
export function triggerLaunch(state: RigState): RigState {
  state.launchDrive = 1
  return state
}

/** Game-time step; a frozen frame keeps the view still so frozen-time taps hit what they see. */
export function stepRig(state: RigState, input: RigInput, dt: number, trackScale: number): RigState {
  if (!(dt > 0)) return state
  const { speed } = input
  const longitudinal = state.lastSpeed === null ? 0 : (speed - state.lastSpeed) / dt
  state.lastSpeed = speed
  state.roll = damp(state.roll, bankAngle(input.lateral, trackScale), BANK_RESPONSE, dt)
  state.pitch = damp(state.pitch, pitchAngle(longitudinal, trackScale), PITCH_RESPONSE, dt)
  state.speedNorm = damp(state.speedNorm, Math.min(Math.max(input.speedNorm, 0), 1), SPEED_FOV_RESPONSE, dt)
  const drop = dropAmount(input.descent)
  state.drop = damp(state.drop, drop, DROP_RESPONSE, dt)
  state.dipFast = damp(state.dipFast, drop, DIP_FAST, dt)
  state.dipSlow = damp(state.dipSlow, drop, DIP_SLOW, dt)
  const launchStep = Math.min(dt, LAUNCH_MAX_STEP)
  state.launchDrive *= Math.exp(-launchStep * LAUNCH_DECAY)
  state.launch = damp(state.launch, state.launchDrive, LAUNCH_ATTACK, launchStep)
  state.airtime = damp(state.airtime, airtimeAmount(input.vertical, trackScale), AIRTIME_RESPONSE, dt)
  state.lift = damp(state.lift, input.lifting ? 1 : 0, LIFT_RESPONSE, dt)
  state.time += dt
  return state
}

/** The drop's dip, 0–1: rises entering a drop, back to 0 once the drop holds. */
export function dipAmount(state: RigState): number {
  return Math.max(0, state.dipFast - state.dipSlow)
}

/** The rig's whole rotation (radians, before the Screen-shake scale): bank, accel pitch, launch, dip and the airtime float. */
export function rigAngles(state: RigState, out: RigAngles): RigAngles {
  const drift = FLOAT_DRIFT_DEG * DEG * state.airtime
  const x = state.time * FLOAT_DRIFT_HZ
  out.pitch = state.pitch + (LAUNCH_PITCH_DEG * state.launch - DIP_DEG * dipAmount(state) + FLOAT_PITCH_DEG * state.airtime) * DEG
    + drift * smoothNoise1(x, 7)
  out.yaw = drift * smoothNoise1(x, 31)
  out.roll = state.roll + drift * smoothNoise1(x, 53)
  return out
}

export interface TrackSamples {
  /** Curve parameters `CURVATURE_SAMPLE_UNITS` behind and ahead of the car, and `LOOK_AHEAD_UNITS` ahead. */
  behindT: number
  aheadT: number
  lookT: number
  /** Arc distance from behind to ahead (world units). */
  span: number
  /** World units per unit of t at the car, over that span. */
  unitsPerT: number
}

const wrap01 = (t: number) => ((t % 1) + 1) % 1

/** Sample points by arc distance (trig curves are uneven in t), wrapping at the loop seam. */
export function sampleTrack(table: ArcTable, t: number, trackScale: number, out: TrackSamples): TrackSamples {
  const s = distanceAtT(table, t)
  const d = CURVATURE_SAMPLE_UNITS * trackScale
  out.behindT = tAtLoopDistance(table, s - d)
  out.aheadT = tAtLoopDistance(table, s + d)
  out.lookT = tAtLoopDistance(table, s + LOOK_AHEAD_UNITS * trackScale)
  out.span = 2 * d
  const dt = wrap01(out.aheadT - out.behindT)
  out.unitsPerT = dt > 0 ? out.span / dt : 0
  return out
}

/**
 * Lateral acceleration (units/s²) along the camera's right axis, tangent × the rails' up (`seatPose` `up`, #715: upside
 * down the view's right is reversed): curvature × v², from the unit tangents `arcSpan` units apart around the car.
 * Positive when the track turns right.
 */
export function lateralAcceleration(
  tangent: Vec3Like,
  up: Vec3Like,
  tangentBehind: Vec3Like,
  tangentAhead: Vec3Like,
  arcSpan: number,
  speed: number,
): number {
  const rx = tangent.y * up.z - tangent.z * up.y
  const ry = tangent.z * up.x - tangent.x * up.z
  const rz = tangent.x * up.y - tangent.y * up.x
  const len = Math.hypot(rx, ry, rz)
  if (!(arcSpan > 0) || len < 1e-6) return 0
  const curvatureRight = (
    (tangentAhead.x - tangentBehind.x) * rx + (tangentAhead.y - tangentBehind.y) * ry + (tangentAhead.z - tangentBehind.z) * rz
  ) / (len * arcSpan)
  return curvatureRight * speed * speed
}

/**
 * Acceleration (units/s²) along the rails' up, from the tangents `arcSpan` apart: negative over a crest (airtime),
 * positive through a loop's apex, where the rails' up points down at its centre.
 */
export function verticalAcceleration(
  up: Vec3Like,
  tangentBehind: Vec3Like,
  tangentAhead: Vec3Like,
  arcSpan: number,
  speed: number,
): number {
  if (!(arcSpan > 0)) return 0
  const along = (tangentAhead.x - tangentBehind.x) * up.x + (tangentAhead.y - tangentBehind.y) * up.y
    + (tangentAhead.z - tangentBehind.z) * up.z
  return (along / arcSpan) * speed * speed
}

function normalize(v: Vec3Like): Vec3Like {
  const len = Math.hypot(v.x, v.y, v.z)
  if (len > 0) {
    v.x /= len
    v.y /= len
    v.z /= len
  }
  return v
}

/** Unit look direction from the unit tangent and unit direction to the point ahead; `out` may alias `toAhead`. */
export function lookAheadDirection(tangent: Vec3Like, toAhead: Vec3Like, out: Vec3Like): Vec3Like {
  out.x = tangent.x + (toAhead.x - tangent.x) * LOOK_AHEAD_BLEND
  out.y = tangent.y + (toAhead.y - tangent.y) * LOOK_AHEAD_BLEND
  out.z = tangent.z + (toAhead.z - tangent.z) * LOOK_AHEAD_BLEND
  normalize(out)
  if (out.x === 0 && out.y === 0 && out.z === 0) {
    out.x = tangent.x
    out.y = tangent.y
    out.z = tangent.z
    return out
  }
  const cos = Math.min(Math.max(out.x * tangent.x + out.y * tangent.y + out.z * tangent.z, -1), 1)
  const angle = Math.acos(cos)
  const max = MAX_LOOK_AHEAD_DEG * DEG
  if (angle <= max) return out
  const sin = Math.sin(angle)
  const a = Math.sin(angle - max) / sin
  const b = Math.sin(max) / sin
  out.x = tangent.x * a + out.x * b
  out.y = tangent.y * a + out.y * b
  out.z = tangent.z * a + out.z * b
  return normalize(out)
}
