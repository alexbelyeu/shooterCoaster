import type { TrackParams } from '@/types/level'
import type { TrackCurve } from './curves/TrackCurve'

/** The coaster's speed along the track (port of Camera.js updateCamGame), pure so a lap can be timed in a unit test. */

// The 2015 game ran frame-dependent physics at ~30-45 fps: slow the 60 fps port to match, and cap runaway downhill speed.
const SPEED_FACTOR = 0.7
const MAX_VELOCITY_MULT = 5 // max velocity = minRollerSpeed * this
/** Track parameter steps are taken in 60 fps frames, at most this many at once (a hitch slows the ride, never skips track). */
export const MAX_RIDE_STEP_FRAMES = 3

export interface RideSpeeds {
  /** Downhill pull per frame, per unit of tangent drop. */
  gravity: number
  min: number
  max: number
}

export function rideSpeeds(track: Pick<TrackParams, 'rollerSpeed' | 'minRollerSpeed'>): RideSpeeds {
  return {
    gravity: track.rollerSpeed * SPEED_FACTOR,
    min: track.minRollerSpeed * SPEED_FACTOR,
    max: track.minRollerSpeed * MAX_VELOCITY_MULT * SPEED_FACTOR,
  }
}

export interface RideState {
  /** Track parameter, 0..1, wrapping. */
  progress: number
  /** Track parameter per 60 fps frame. */
  velocity: number
}

const wrap01 = (t: number) => ((t % 1) + 1) % 1

/** Rides `frames` 60 fps frames in steps of at most `MAX_RIDE_STEP_FRAMES`. */
export function advanceRide(state: RideState, curve: TrackCurve, speeds: RideSpeeds, frames: number): RideState {
  let left = frames
  do {
    const step = Math.min(left, MAX_RIDE_STEP_FRAMES)
    left -= step
    state.progress = wrap01(state.progress + state.velocity * step)
    const drop = curve.getTangentAt(state.progress).y
    state.velocity = Math.min(Math.max(state.velocity - drop * speeds.gravity * step, speeds.min), speeds.max)
  } while (left > 0)
  return state
}

/** Seconds one lap takes from a standing start, ridden at 60 fps; Infinity past `maxSeconds`. */
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
