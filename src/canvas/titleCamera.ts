/**
 * Title-screen fly-by: two keyframed camera shots that take turns, each held for SHOT_S and blended
 * into the next over BLEND_S with a crane-up so the move clears the tents and flags.
 * Pure (no three / React) so the timeline is unit-tested; poses are written into caller-owned tuples.
 */

export type Vec3 = [number, number, number]

export const SHOT_S = 12
export const BLEND_S = 4
/** Extra height at the middle of a blend. */
const BLEND_LIFT = 22

/** Wide orbit around the whole park, as the title always had. */
function orbitShot(t: number, pos: Vec3, target: Vec3) {
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
const LOOK_TO: Vec3 = [80, 75, -60]

function dollyShot(u: number, pos: Vec3, target: Vec3) {
  const e = smoothstep(u)
  for (let i = 0; i < 3; i++) {
    pos[i] = DOLLY_FROM[i] + (DOLLY_TO[i] - DOLLY_FROM[i]) * e
    target[i] = LOOK_FROM[i] + (LOOK_TO[i] - LOOK_FROM[i]) * e
  }
}

function smoothstep(x: number): number {
  const c = Math.min(1, Math.max(0, x))
  return c * c * (3 - 2 * c)
}

/** Shot `index` (even = orbit, odd = dolly) at time t; it is on screen from (index * SHOT_S - BLEND_S) to ((index + 1) * SHOT_S). */
function shotPose(index: number, t: number, pos: Vec3, target: Vec3) {
  if (index % 2 === 0) orbitShot(t, pos, target)
  else dollyShot((t - (index * SHOT_S - BLEND_S)) / (SHOT_S + BLEND_S), pos, target)
}

const nextPos: Vec3 = [0, 0, 0]
const nextTarget: Vec3 = [0, 0, 0]

/** Index of the shot that owns time t (the one being blended out of, during a blend). */
export function titleShotIndex(t: number): number {
  return Math.floor(Math.max(0, t) / SHOT_S)
}

/** Camera position and look-at target at time t (seconds since the title appeared). */
export function titleCameraPose(t: number, pos: Vec3, target: Vec3): void {
  const time = Math.max(0, t)
  const index = titleShotIndex(time)
  shotPose(index, time, pos, target)
  const blendStart = (index + 1) * SHOT_S - BLEND_S
  if (time <= blendStart) return
  const w = (time - blendStart) / BLEND_S
  const k = smoothstep(w)
  shotPose(index + 1, time, nextPos, nextTarget)
  for (let i = 0; i < 3; i++) {
    pos[i] += (nextPos[i] - pos[i]) * k
    target[i] += (nextTarget[i] - target[i]) * k
  }
  pos[1] += Math.sin(Math.PI * w) * BLEND_LIFT
}
