import { distanceAtT, indexAtT, type ArcTable } from './arcLength'
import type { TrackCurve } from './curves/TrackCurve'

/**
 * The coaster's speed rule (port of Camera.js updateCamGame), pure: `CoasterCamera` rides it and
 * spawning predicts the ride with it (`rideProfile`). Velocity is track fraction per 60 fps frame.
 */

// The 2015 game ran frame-dependent physics at ~30-45 fps: slow the 60 fps port to match, and cap runaway downhill speed.
const SPEED_FACTOR = 0.7
const MAX_VELOCITY_MULT = 5 // max velocity = minRollerSpeed * this
/** A hitch rides at most this many 60 fps frames at once: it slows the ride, never skips track. */
export const MAX_RIDE_STEP_FRAMES = 3

export interface RideSpeeds {
  /** Speed gained per frame per unit of descent (the tangent's -y). */
  roll: number
  min: number
  max: number
}

export function rideSpeeds({ rollerSpeed, minRollerSpeed }: { rollerSpeed: number; minRollerSpeed: number }): RideSpeeds {
  return {
    roll: rollerSpeed * SPEED_FACTOR,
    min: minRollerSpeed * SPEED_FACTOR,
    max: minRollerSpeed * MAX_VELOCITY_MULT * SPEED_FACTOR,
  }
}

/** Velocity after `frames` on track whose unit tangent rises by `tangentY`, clamped to the ride's speeds. */
export function nextVelocity(velocity: number, tangentY: number, frames: number, speeds: RideSpeeds): number {
  return Math.min(Math.max(velocity - tangentY * speeds.roll * frames, speeds.min), speeds.max)
}

/** `progress` is the track parameter (0..1, wrapping), `velocity` that per 60 fps frame. */
export interface RideState {
  progress: number
  velocity: number
}

const wrap01 = (t: number) => ((t % 1) + 1) % 1

/** Port of Camera.js updateCamGame: rides `frames` 60 fps frames in steps of at most `MAX_RIDE_STEP_FRAMES`. */
export function advanceRide(state: RideState, curve: TrackCurve, speeds: RideSpeeds, frames: number): RideState {
  let left = frames
  do {
    const step = Math.min(left, MAX_RIDE_STEP_FRAMES)
    left -= step
    state.progress = wrap01(state.progress + state.velocity * step)
    state.velocity = nextVelocity(state.velocity, curve.getTangentAt(state.progress).y, step, speeds)
  } while (left > 0)
  return state
}

/** From a standing start at 60 fps; Infinity past `maxSeconds`. */
export function lapSeconds(curve: TrackCurve, speeds: RideSpeeds, maxSeconds = 600): number {
  const state: RideState = { progress: 0, velocity: 0 }
  let travelled = 0
  for (let frame = 1; frame <= maxSeconds * 60; frame++) {
    const before = state.progress
    advanceRide(state, curve, speeds, 1)
    travelled += wrap01(state.progress - before)
    if (travelled >= 1) return frame / 60
  }
  return Infinity
}

/** Profile samples per second of level time. */
const PROFILE_RATE = 10

/**
 * Arc distance ridden at each tenth of a second of level time over `seconds`, from the start at rest:
 * the ride a run takes from GO at 60 fps (the level timer and the ride both run on game time).
 */
export function rideProfile(table: ArcTable, speeds: RideSpeeds, seconds: number): Float64Array {
  const framesPerSample = 60 / PROFILE_RATE
  const profile = new Float64Array(Math.ceil(seconds * PROFILE_RATE) + 1)
  const n = table.count - 1
  let t = 0
  let velocity = 0
  let ridden = 0
  for (let k = 1; k < profile.length; k++) {
    for (let f = 0; f < framesPerSample; f++) {
      // The track parameter isn't arc length (`TrigCurve`): measure the arc it moves through.
      const from = distanceAtT(table, t)
      t = (t + velocity) % 1
      const step = distanceAtT(table, t) - from
      ridden += step < 0 ? step + table.length : step
      const i = indexAtT(table, t)
      const a = (i - 1 + n) % n
      const b = (i + 1) % n
      const dx = table.x[b] - table.x[a]
      const dy = table.y[b] - table.y[a]
      const dz = table.z[b] - table.z[a]
      velocity = nextVelocity(velocity, dy / (Math.hypot(dx, dy, dz) || 1), 1, speeds)
    }
    profile[k] = ridden
  }
  return profile
}

/** Arc distance ridden between level times `from` and `to` (clamped to the profile). */
export function riddenBetween(profile: Float64Array, from: number, to: number): number {
  return Math.max(0, riddenAt(profile, to) - riddenAt(profile, from))
}

function riddenAt(profile: Float64Array, time: number): number {
  const x = Math.min(Math.max(time * PROFILE_RATE, 0), profile.length - 1)
  const i = Math.min(Math.floor(x), profile.length - 2)
  if (i < 0) return 0
  return profile[i] + (profile[i + 1] - profile[i]) * (x - i)
}
