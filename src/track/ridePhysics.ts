import type { TrackParams } from '@/types/level'
import type { TrackCurve } from './curves/TrackCurve'

// The 2015 game ran frame-dependent physics at ~30-45 fps: slow the 60 fps port to match, and cap runaway downhill speed.
const SPEED_FACTOR = 0.7
const MAX_VELOCITY_MULT = 5
/** A hitch rides at most this many 60 fps frames at once: it slows the ride, never skips track. */
export const MAX_RIDE_STEP_FRAMES = 3

export interface RideSpeeds {
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

/** `progress` is the track parameter (0..1, wrapping), `velocity` that per 60 fps frame. */
export interface RideState {
  progress: number
  velocity: number
}

const wrap01 = (t: number) => ((t % 1) + 1) % 1

/** Port of Camera.js updateCamGame. */
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
