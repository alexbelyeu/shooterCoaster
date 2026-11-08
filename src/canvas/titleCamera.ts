/**
 * Title fly-by (#376, #419): a sequence of camera shots taking turns, each blended into the next with a lift that
 * clears the tents and flags. The menu sequence orbits the park, chases the coaster and dollies to the Ferris wheel;
 * attract mode cuts closer on the ride. Shot cuts lock to the title score's bars (`beatLockedRate`).
 */
import { CAR_SPACING, CARS, type TitleRide } from './titleCoaster'

export type Vec3 = [number, number, number]
export type TitleCameraMode = 'menu' | 'attract'

export const SHOT_S = 12
export const BLEND_S = 4
const BLEND_LIFT = 22
export const ATTRACT_SHOT_S = 8
const ATTRACT_BLEND_S = BLEND_S

/** What a shot can frame: the coaster at `rideTime`. */
export interface ShotContext {
  ride: TitleRide
  rideTime: number
}

/** t = camera seconds, u = 0..1 through the shot's time on screen. */
type Shot = (t: number, u: number, ctx: ShotContext, pos: Vec3, target: Vec3) => void

function orbitShot(t: number, _u: number, _ctx: ShotContext, pos: Vec3, target: Vec3) {
  const a = t * 0.08
  pos[0] = Math.cos(a) * 180
  pos[1] = 60 + Math.sin(a * 0.5) * 8
  pos[2] = Math.sin(a) * 180
  target[0] = 0
  target[1] = 30
  target[2] = 0
}

/** Low dolly outside the tent ring, panning from the big carousel up to the Ferris wheel against the sunset. */
const DOLLY_FROM: Vec3 = [-170, 18, 120]
const DOLLY_TO: Vec3 = [-20, 32, 175]
const LOOK_FROM: Vec3 = [-60, 18, -40]
const LOOK_TO: Vec3 = [50, 75, -75]

function dollyShot(_t: number, u: number, _ctx: ShotContext, pos: Vec3, target: Vec3) {
  const e = smoothstep(u)
  for (let i = 0; i < 3; i++) {
    pos[i] = DOLLY_FROM[i] + (DOLLY_TO[i] - DOLLY_FROM[i]) * e
    target[i] = LOOK_FROM[i] + (LOOK_TO[i] - LOOK_FROM[i]) * e
  }
}

/** The chase sits back, up and outside the loop, so the whole train shows below the logo in three-quarter view. */
const CHASE_BEHIND = CARS * CAR_SPACING + 30
const CHASE_AHEAD = 40
const CHASE_HEIGHT = 16
const CHASE_OUT = 14
const _a: Vec3 = [0, 0, 0]

/** Rides the rails behind the train, looking past it down the track. */
function chaseShot(_t: number, _u: number, { ride, rideTime }: ShotContext, pos: Vec3, target: Vec3) {
  const lead = ride.leadDistance(rideTime)
  ride.pointAt(lead - CHASE_BEHIND, _a)
  const r = Math.hypot(_a[0], _a[2])
  pos[0] = _a[0] * (1 + CHASE_OUT / r)
  pos[1] = _a[1] + CHASE_HEIGHT
  pos[2] = _a[2] * (1 + CHASE_OUT / r)
  ride.pointAt(lead + CHASE_AHEAD, target)
  target[1] += 2
}

/** Trackside crane outside the loop, keeping pace a little ahead of the train and looking back at it. */
function trackingShot(_t: number, u: number, { ride, rideTime }: ShotContext, pos: Vec3, target: Vec3) {
  ride.pointAt(ride.leadDistance(rideTime) - (CARS * CAR_SPACING) / 2, target)
  const a = Math.atan2(target[2], target[0]) + 0.3
  pos[0] = Math.cos(a) * 196
  pos[1] = 20 + 10 * u
  pos[2] = Math.sin(a) * 196
}

const MENU_SHOTS: Shot[] = [orbitShot, chaseShot, dollyShot]
const ATTRACT_SHOTS: Shot[] = [chaseShot, trackingShot, orbitShot]

function smoothstep(x: number): number {
  const c = Math.min(1, Math.max(0, x))
  return c * c * (3 - 2 * c)
}

/** Shot `index` at time t; it is on screen from (index * shotS - blendS) to ((index + 1) * shotS). */
function shotPose(shots: Shot[], shotS: number, blendS: number, index: number, t: number, ctx: ShotContext, pos: Vec3, target: Vec3) {
  const u = (t - (index * shotS - blendS)) / (shotS + blendS)
  shots[index % shots.length](t, u, ctx, pos, target)
}

const nextPos: Vec3 = [0, 0, 0]
const nextTarget: Vec3 = [0, 0, 0]

export function titleShotS(mode: TitleCameraMode): number {
  return mode === 'menu' ? SHOT_S : ATTRACT_SHOT_S
}

export function titleShotIndex(t: number, mode: TitleCameraMode = 'menu'): number {
  return Math.floor(Math.max(0, t) / titleShotS(mode))
}

/** t = camera seconds in this mode's sequence. */
export function titleCameraPose(t: number, ctx: ShotContext, pos: Vec3, target: Vec3, mode: TitleCameraMode = 'menu'): void {
  const shots = mode === 'menu' ? MENU_SHOTS : ATTRACT_SHOTS
  const shotS = titleShotS(mode)
  const blendS = mode === 'menu' ? BLEND_S : ATTRACT_BLEND_S
  const time = Math.max(0, t)
  const index = titleShotIndex(time, mode)
  shotPose(shots, shotS, blendS, index, time, ctx, pos, target)
  const blendStart = (index + 1) * shotS - blendS
  if (time <= blendStart) return
  const w = (time - blendStart) / blendS
  shotPose(shots, shotS, blendS, index + 1, time, ctx, nextPos, nextTarget)
  blendPose(pos, target, nextPos, nextTarget, w)
}

/** Moves (pos, target) a fraction `w` (eased) of the way to (toPos, toTarget), lifting mid-move over the tents. */
export function blendPose(pos: Vec3, target: Vec3, toPos: Vec3, toTarget: Vec3, w: number): void {
  const k = smoothstep(w)
  for (let i = 0; i < 3; i++) {
    pos[i] += (toPos[i] - pos[i]) * k
    target[i] += (toTarget[i] - target[i]) * k
  }
  pos[1] += Math.sin(Math.PI * Math.min(1, Math.max(0, w))) * BLEND_LIFT
}

export interface BeatGrid {
  /** Audio time of the score's beat 0. */
  origin: number
  beatS: number
  beats: number
}

/** How far the camera clock may run fast or slow to land its cuts on the music's bar lines. */
export const BEAT_LOCK_MAX = 0.1

/**
 * Camera clock rate that lands the next shot cut on a bar line: the cut is `dc` camera seconds away; at rate
 * `dc / target` it arrives in `target` real seconds, the bar line nearest to it. 1 while there is no music.
 */
export function beatLockedRate(camTime: number, shotS: number, grid: BeatGrid | null, audioNow: number): number {
  if (!grid || grid.beatS <= 0) return 1
  const dc = (Math.floor(camTime / shotS) + 1) * shotS - camTime
  if (dc < 0.1) return 1
  const barS = grid.beatS * grid.beats
  const intoBar = (((audioNow - grid.origin) % barS) + barS) % barS
  const firstBar = barS - intoBar
  let target = firstBar + Math.round((dc - firstBar) / barS) * barS
  if (target <= 0.05) target += barS
  return Math.min(1 + BEAT_LOCK_MAX, Math.max(1 - BEAT_LOCK_MAX, dc / target))
}
