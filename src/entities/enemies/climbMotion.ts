/** The Climber's route up its wall and climb cycle (#453), in wall coordinates: `u` across, `v` up, world units. */
import { createRng } from '@/utils/rng'

/** World units per metre at the figurine's scale (it stands ~1.75 m, `CLIMBER_SCALE` × its model). */
export const METRE = 33

export const CLIMB = {
  /** Rise per move, one hand to the next hold (±15 %). */
  step: 26,
  drift: 8,
  margin: 30,
  /** Its origin stops this far under the top: hands on the lip, it tops out. */
  topOut: 30,
  /** Seconds: the lead hand reaches up, the body pulls up to it, a breath. */
  reach: 0.25,
  pull: 0.3,
  rest: 0.1,
  /** Every `clipEvery` moves it stops to clip a quickdraw for `clip` seconds. */
  clipEvery: 6,
  clip: 1.2,
  /** Where the lead arm ends a move (bent, its hand on the hold the body pulled up to). */
  bent: 0.35,
} as const

const MOVE_SECONDS = CLIMB.reach + CLIMB.pull + CLIMB.rest

export interface ClimbRoute {
  /** Body positions, one per hold; the first is where it starts, the last at the top. */
  u: number[]
  v: number[]
  /** Game seconds each move starts, after the start; a move goes from hold `k` to `k + 1`. */
  moveStart: number[]
  duration: number
}

export type ClimbPhase = 'reach' | 'pull' | 'rest' | 'clip' | 'topped'

export interface ClimbPose {
  u: number
  v: number
  phase: ClimbPhase
  /** 0 left, 1 right; alternates move by move. */
  lead: 0 | 1
  /** Left and right arm, 0 (hand low on the wall) to 1 (at full reach overhead). */
  arms: [number, number]
  /** Hip roll, -1 to 1: the leg under the trailing arm steps up as the body pulls (a cross pattern). */
  legs: number
  /** Reached the top: it escapes (`EnemyBase` despawns it, unscored). */
  escaped: boolean
}

export const newClimbPose = (): ClimbPose => ({ u: 0, v: 0, phase: 'rest', lead: 0, arms: [0, CLIMB.bent], legs: 1, escaped: false })

export function climbRoute(start: { u: number; v: number }, wall: { width: number; height: number }, seed: number): ClimbRoute {
  const rng = createRng(seed)
  const top = Math.max(start.v, wall.height - CLIMB.topOut)
  const uMin = Math.min(CLIMB.margin, wall.width / 2)
  const uMax = Math.max(wall.width - CLIMB.margin, wall.width / 2)
  const clampU = (u: number) => Math.min(uMax, Math.max(uMin, u))
  const u = [clampU(start.u)]
  const v = [start.v]
  while (v[v.length - 1] < top) {
    const last = v.length - 1
    v.push(Math.min(top, v[last] + CLIMB.step * (0.85 + 0.3 * rng())))
    u.push(clampU(u[last] + (rng() * 2 - 1) * CLIMB.drift))
  }
  const moveStart: number[] = []
  let t = 0
  for (let k = 0; k < v.length - 1; k++) {
    moveStart.push(t)
    t += MOVE_SECONDS
    if ((k + 1) % CLIMB.clipEvery === 0 && k + 1 < v.length - 1) t += CLIMB.clip
  }
  return { u, v, moveStart, duration: t }
}

const ease = (x: number) => x * x * (3 - 2 * x)

/** Into `out`: no allocation per frame. */
export function climbPose(route: ClimbRoute, t: number, out: ClimbPose): ClimbPose {
  const moves = route.moveStart.length
  const last = route.v.length - 1
  if (moves === 0 || t >= route.duration) return setPose(out, route.u[last], route.v[last], 'topped', 0, 0, 0, 0, true)
  let k = 0
  while (k + 1 < moves && route.moveStart[k + 1] <= t) k++
  const tau = Math.max(0, t - route.moveStart[k])
  const lead = (k % 2) as 0 | 1
  const legSign = lead === 0 ? -1 : 1
  if (tau < CLIMB.reach) {
    return setPose(out, route.u[k], route.v[k], 'reach', lead, ease(tau / CLIMB.reach), CLIMB.bent, legSign, false)
  }
  if (tau < CLIMB.reach + CLIMB.pull) {
    const p = ease((tau - CLIMB.reach) / CLIMB.pull)
    const u = route.u[k] + (route.u[k + 1] - route.u[k]) * p
    const v = route.v[k] + (route.v[k + 1] - route.v[k]) * p
    return setPose(out, u, v, 'pull', lead, 1 - (1 - CLIMB.bent) * p, CLIMB.bent * (1 - p), legSign * (1 - 2 * p), false)
  }
  const after = tau - MOVE_SECONDS
  // The clip: the free hand (the next move's lead) goes up to the bolt and back.
  const clip = after >= 0 ? Math.sin(Math.PI * Math.min(1, after / CLIMB.clip)) : 0
  return setPose(out, route.u[k + 1], route.v[k + 1], after >= 0 ? 'clip' : 'rest', lead, CLIMB.bent, 0.55 * clip, -legSign, false)
}

function setPose(
  out: ClimbPose, u: number, v: number, phase: ClimbPhase, lead: 0 | 1, leadArm: number, trailArm: number, legs: number, escaped: boolean,
): ClimbPose {
  out.u = u
  out.v = v
  out.phase = phase
  out.lead = lead
  out.arms[lead] = leadArm
  out.arms[1 - lead] = trailArm
  out.legs = legs
  out.escaped = escaped
  return out
}
