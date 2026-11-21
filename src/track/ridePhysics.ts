import { distanceAtT, indexAtT, tAtLoopDistance, type ArcTable } from './arcLength'
import type { TrackCurve } from './curves/TrackCurve'
import { buildRidePlan, PLAN_RATE, planDistance, planSpeed, planStopShare, planTimeAt, planZoneAt, type RidePlan } from './rideV2'
import { checkMechanics, withMechanics } from './mechanics'
import type { SpeedZone, TrackParams } from '@/types/level'

/**
 * The coaster's speed rule (port of Camera.js updateCamGame), pure: `CoasterCamera` rides it and
 * spawning predicts the ride with it (`rideProfile`). Velocity is track fraction per 60 fps frame.
 * A level with `ride: 'v2'` rides its solved plan instead (`rideV2.ts`, #696).
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
  /** The v2 ride's plan: when set, the ride follows it and the fields above are 0, unused. */
  plan?: RidePlan
}

export function rideSpeeds({ rollerSpeed, minRollerSpeed }: { rollerSpeed: number; minRollerSpeed: number }): RideSpeeds {
  return {
    roll: rollerSpeed * SPEED_FACTOR,
    min: minRollerSpeed * SPEED_FACTOR,
    max: minRollerSpeed * MAX_VELOCITY_MULT * SPEED_FACTOR,
  }
}

/**
 * The level's ride: its v2 plan when it opts in (with its mechanics' zones and stops, #699), else today's rule, whose
 * only mechanic is a junction (#702: no zones). Cold: solves the plan (a few ms).
 */
export function rideModel(track: TrackParams, table: ArcTable): RideSpeeds {
  if (track.ride === 'v2') {
    return { roll: 0, min: 0, max: 0, plan: buildRidePlan(table, withMechanics(track.rideV2 ?? {}, track.mechanics, table.length)) }
  }
  if (track.mechanics?.some((m) => m.kind !== 'junction')) throw new Error('ride mechanics need the v2 ride (track.ride: "v2")')
  checkMechanics(track.mechanics)
  return rideSpeeds(track)
}

/** Velocity after `frames` on track whose unit tangent rises by `tangentY`, clamped to the ride's speeds. */
export function nextVelocity(velocity: number, tangentY: number, frames: number, speeds: RideSpeeds): number {
  return Math.min(Math.max(velocity - tangentY * speeds.roll * frames, speeds.min), speeds.max)
}

/** `progress` is the track parameter (0..1, wrapping), `velocity` that per 60 fps frame, `time` seconds ridden since GO. */
export interface RideState {
  progress: number
  velocity: number
  time: number
}

const wrap01 = (t: number) => ((t % 1) + 1) % 1

/** Back at the start, at rest. */
export function resetRide(state: RideState): void {
  state.progress = 0
  state.velocity = 0
  state.time = 0
}

/** Puts the car at track parameter `t` (the smoke's `rideTo`); a v2 ride resumes its plan from the first time it gets there. */
export function jumpRide(state: RideState, speeds: RideSpeeds, t: number): void {
  state.progress = t
  if (speeds.plan) state.time = planTimeAt(speeds.plan, distanceAtT(speeds.plan.table, t))
}

/** 0 at the ride's slowest, 1 at its fastest. */
export function rideSpeedNorm(state: RideState, speeds: RideSpeeds): number {
  const { plan } = speeds
  const norm = plan
    ? (planSpeed(plan, state.time) - plan.minSpeed) / (plan.maxSpeed - plan.minSpeed || 1)
    : (state.velocity - speeds.min) / (speeds.max - speeds.min)
  return Math.max(0, Math.min(norm, 1))
}

/** Speed as a share of the ride's top speed, 0–1: unlike `rideSpeedNorm`, the slowest speed still has some (the wind's input). */
export function rideTopShare(state: RideState, speeds: RideSpeeds): number {
  const { plan } = speeds
  const share = plan ? planSpeed(plan, state.time) / (plan.maxSpeed || 1) : state.velocity / speeds.max
  return Math.max(0, Math.min(share, 1))
}

/** The v2 zone the car is in; today's rule has no zones. */
export function rideZone(state: RideState, speeds: RideSpeeds): SpeedZone['kind'] | null {
  return speeds.plan ? planZoneAt(speeds.plan, state.time) : null
}

/** How far through a stop (a drop track's top, a turntable) the car is, -1 when moving; today's rule never stops. */
export function rideStopShare(state: RideState, speeds: RideSpeeds): number {
  return speeds.plan ? planStopShare(speeds.plan, state.time) : -1
}

/** Today's rule has no chain: climbing this steeply while held at its minimum speed is what pulls the car up. */
const LIFT_MIN_CLIMB = 0.08

/** On the chain (its clank): a v2 ride inside a `lift` zone, today's rule climbing at its minimum speed. */
export function rideOnLift(state: RideState, speeds: RideSpeeds, tangentY: number): boolean {
  if (speeds.plan) return rideZone(state, speeds) === 'lift'
  return tangentY > LIFT_MIN_CLIMB && state.velocity <= speeds.min * 1.001
}

/** The one launch signal (`triggerLaunch`, the whoosh): GO leaving the station, or a v2 ride entering a `launch` zone. */
export function rideLaunches(go: boolean, zone: SpeedZone['kind'] | null, lastZone: SpeedZone['kind'] | null): boolean {
  return go || (zone === 'launch' && lastZone !== 'launch')
}

/**
 * The 60 fps frames a live frame of `seconds` rides. Today's rule caps a hitch at `MAX_RIDE_STEP_FRAMES` (it slows
 * the ride, never skips track); a v2 ride takes the whole step, so its clock keeps pace with the level timer's and
 * spawning's `rideProfile` at any frame rate.
 */
export function rideStepFrames(speeds: RideSpeeds, seconds: number): number {
  return speeds.plan ? seconds * 60 : Math.min(seconds * 60, MAX_RIDE_STEP_FRAMES)
}

/** The rise of the track's unit tangent at track parameter `t`: what today's rule speeds up or slows down by. */
export type TangentY = (t: number) => number

/** The curve's own tangent (the live ride). */
export function curveTangentY(curve: TrackCurve): TangentY {
  return (t) => curve.getTangentAt(t).y
}

/** The tangent from the arc table's neighbouring samples (spawning's prediction: no curve evaluation per frame). */
export function tableTangentY(table: ArcTable): TangentY {
  const n = table.count - 1
  return (t) => {
    const i = indexAtT(table, t)
    const a = (i - 1 + n) % n
    const b = (i + 1) % n
    const dx = table.x[b] - table.x[a]
    const dy = table.y[b] - table.y[a]
    const dz = table.z[b] - table.z[a]
    return dy / (Math.hypot(dx, dy, dz) || 1)
  }
}

/**
 * Port of Camera.js updateCamGame: rides `frames` 60 fps frames in steps of at most `MAX_RIDE_STEP_FRAMES`. The one
 * integrator: `CoasterCamera` rides it on the curve's tangent, `rideProfile` predicts the ride with it on the table's.
 */
export function advanceRide(state: RideState, tangentY: TangentY, speeds: RideSpeeds, frames: number): RideState {
  state.time += frames / 60
  if (speeds.plan) return followPlan(state, speeds.plan)
  let left = frames
  do {
    const step = Math.min(left, MAX_RIDE_STEP_FRAMES)
    left -= step
    state.progress = wrap01(state.progress + state.velocity * step)
    state.velocity = nextVelocity(state.velocity, tangentY(state.progress), step, speeds)
  } while (left > 0)
  return state
}

/** The v2 ride at `state.time`: its velocity is the track parameter the plan covers over the next frame. */
function followPlan(state: RideState, plan: RidePlan): RideState {
  const dist = planDistance(plan, state.time)
  state.progress = tAtLoopDistance(plan.table, dist)
  state.velocity = wrap01(tAtLoopDistance(plan.table, dist + planSpeed(plan, state.time) / PLAN_RATE) - state.progress)
  return state
}

/** From a standing start at 60 fps; Infinity past `maxSeconds`. */
export function lapSeconds(curve: TrackCurve, speeds: RideSpeeds, maxSeconds = 600): number {
  if (speeds.plan) {
    const lap = planTimeAt(speeds.plan, speeds.plan.table.length)
    return lap <= maxSeconds ? lap : Infinity
  }
  const state: RideState = { progress: 0, velocity: 0, time: 0 }
  const tangentY = curveTangentY(curve)
  let travelled = 0
  for (let frame = 1; frame <= maxSeconds * 60; frame++) {
    const before = state.progress
    advanceRide(state, tangentY, speeds, 1)
    travelled += wrap01(state.progress - before)
    if (travelled >= 1) return frame / 60
  }
  return Infinity
}

/** Profile samples per second of level time. */
export const PROFILE_RATE = 10

/**
 * Arc distance ridden at each tenth of a second of level time over `seconds`, from the start at rest, if the ride kept
 * pace with the level timer. It may fall behind: slow-mo (FRENZY) slows the ride and not the timer, and today's rule
 * caps a hitch at `MAX_RIDE_STEP_FRAMES`. Spawning leaves slack for that (`RIDE_PACE_SLACK`).
 */
export function rideProfile(table: ArcTable, speeds: RideSpeeds, seconds: number): Float64Array {
  const framesPerSample = 60 / PROFILE_RATE
  const profile = new Float64Array(Math.ceil(seconds * PROFILE_RATE) + 1)
  if (speeds.plan) {
    for (let k = 1; k < profile.length; k++) profile[k] = planDistance(speeds.plan, k / PROFILE_RATE)
    return profile
  }
  const tangentY = tableTangentY(table)
  const state: RideState = { progress: 0, velocity: 0, time: 0 }
  let ridden = 0
  for (let k = 1; k < profile.length; k++) {
    for (let f = 0; f < framesPerSample; f++) {
      // The track parameter isn't arc length (`TrigCurve`): measure the arc it moves through.
      const from = distanceAtT(table, state.progress)
      advanceRide(state, tangentY, speeds, 1)
      const step = distanceAtT(table, state.progress) - from
      ridden += step < 0 ? step + table.length : step
    }
    profile[k] = ridden
  }
  return profile
}

/** Arc distance ridden between level times `from` and `to` (clamped to the profile). */
export function riddenBetween(profile: Float64Array, from: number, to: number): number {
  return Math.max(0, riddenAt(profile, to) - riddenAt(profile, from))
}

/** Arc distance ridden `time` seconds after GO, interpolated between the profile's samples. */
export function riddenAt(profile: Float64Array, time: number): number {
  const x = Math.min(Math.max(time * PROFILE_RATE, 0), profile.length - 1)
  const i = Math.min(Math.floor(x), profile.length - 2)
  if (i < 0) return 0
  return profile[i] + (profile[i + 1] - profile[i]) * (x - i)
}
