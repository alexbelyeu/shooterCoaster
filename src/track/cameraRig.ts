/**
 * Coaster camera weight (#123), rotation only: CoasterCamera applies it after `lookAt`
 * like the kill trauma, so the camera never leaves the track pose.
 * Accelerations are world units/s² ÷ trackScale; riding every level, lateral runs
 * ~10 / 130 / 300 at p50 / p90 / p99 and longitudinal ~20 / 150 / 250.
 */

export interface Vec3Like {
  x: number
  y: number
  z: number
}

/** Peak bank / pitch (degrees) on the 'full' Screen-shake setting; a p90 turn banks ~5.5°. */
export const MAX_BANK_DEG = 8
export const MAX_PITCH_DEG = 3
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
  return -MAX_BANK_DEG * DEG * Math.tanh(lateralAccel / (LATERAL_ACCEL_REF * trackScale))
}

/** `rotateX` radians: speeding up tips the view up, braking down. */
export function pitchAngle(longitudinalAccel: number, trackScale: number): number {
  if (!Number.isFinite(longitudinalAccel)) return 0
  return MAX_PITCH_DEG * DEG * Math.tanh(longitudinalAccel / (LONGITUDINAL_ACCEL_REF * trackScale))
}

/** 0 on the flat or climbing, easing to 1 on a steep drop. */
export function dropAmount(descent: number): number {
  if (!Number.isFinite(descent)) return 0
  const x = Math.min(Math.max((descent - DROP_START) / (DROP_FULL - DROP_START), 0), 1)
  return x * x * (3 - 2 * x)
}

export interface RigState {
  /** Radians, before the Screen-shake scale (so Off is exactly 0 at once). */
  roll: number
  pitch: number
  speedNorm: number
  /** Smoothed `dropAmount`, 0–1. */
  drop: number
  lastSpeed: number | null
}

export function createRigState(): RigState {
  return { roll: 0, pitch: 0, speedNorm: 0, drop: 0, lastSpeed: null }
}

export function resetRig(state: RigState): RigState {
  state.roll = 0
  state.pitch = 0
  state.speedNorm = 0
  state.drop = 0
  state.lastSpeed = null
  return state
}

/** Game-time step; a frozen frame keeps the view still so frozen-time taps hit what they see. `descent` is -tangent.y. */
export function stepRig(
  state: RigState,
  lateralAccel: number,
  speed: number,
  speedNorm: number,
  dt: number,
  trackScale: number,
  descent = 0,
): RigState {
  if (!(dt > 0)) return state
  const longitudinal = state.lastSpeed === null ? 0 : (speed - state.lastSpeed) / dt
  state.lastSpeed = speed
  state.roll = damp(state.roll, bankAngle(lateralAccel, trackScale), BANK_RESPONSE, dt)
  state.pitch = damp(state.pitch, pitchAngle(longitudinal, trackScale), PITCH_RESPONSE, dt)
  state.speedNorm = damp(state.speedNorm, Math.min(Math.max(speedNorm, 0), 1), SPEED_FOV_RESPONSE, dt)
  state.drop = damp(state.drop, dropAmount(descent), DROP_RESPONSE, dt)
  return state
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
