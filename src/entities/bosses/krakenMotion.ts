import type { HeightFunction } from '@/utils/terrainNoise'
import type { Rng } from '@/utils/rng'
import type { TrackIndex } from '@/levels/environments/shared/trackClearance'
import type { Vec3 } from '@/entities/spawning/spawnPlacement'

/** The Kraken's motion, pure and allocation-free per frame; a tentacle bends in its vertical plane, `u` along `out` (away from the rider), `y` up. */

export const KRAKEN_TENTACLE = {
  count: 5,
  segments: 10,
  segLen: 34,
  baseRadius: 40,
  tipRadius: 6,
  /** Segment whose rider-facing side carries the sucker pad. */
  padSegment: 6,
  stagger: 0.35,
  riseS: 1.5,
  /** Up this long after the rise unless it falls behind the rider first. */
  upS: 6.5,
  sinkS: 1,
  gapS: 0.6,
  /** Slam starts after the rise begins, plus `slamSpread` × the tentacle's seed so they take turns. */
  slams: [2.4, 5.4],
  slamSpread: 0.4,
  windupS: 0.5,
  strikeS: 0.25,
  holdS: 0.35,
  recoverS: 0.9,
  /** Total bend (radians from vertical at the tip): swaying, wound up, slammed onto the water. */
  sway: 0.28,
  windup: -0.55,
  slam: 3.2,
  /** At rest the tip hooks back towards the rider; it unfurls as the tentacle bends over. */
  curl: -1.1,
} as const

export const KRAKEN_HEAD = {
  riseS: 1.8,
  upS: 7,
  sinkS: 1.2,
  defeatSinkS: 2.2,
  gapS: 0.4,
  rx: 190,
  ry: 130,
  rz: 160,
  /** Below the water when down; bobs this much when up. */
  depth: 160,
  bob: 7,
  /** Eye on the rider-facing side of the dome, above the water. */
  eyeUp: 64,
  eyeOut: 150,
  eyeRadius: 42,
} as const

/** Surfacing spots: this far from the camera, within `yaw` radians of where it looks (inside the frame on 16:9 and on a phone). */
export const SPOTS = {
  tentacle: { distMin: 550, distMax: 1150, yaw: 0.45, spacing: 170 },
  head: { distMin: 600, distMax: 1150, yaw: 0.45, spacing: 0 },
  /** 2D track clearance (rails and towers) of the base and along the slam. */
  clearance: 45,
  /** In the water: the drawn seabed must be this far under the surface. */
  maxGround: -8,
  /** The ride loops over most of the sea in front of it, so most tries land on it. */
  attempts: 40,
} as const

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x))
  return t * t * (3 - 2 * t)
}

/** Overshoots past 1 and settles: an eruption, not a lift. */
const erupt = (x: number) => {
  const t = Math.min(1, Math.max(0, x))
  const c = 1.9
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2
}

export interface TentacleFrame {
  /** 0 under water … 1 fully out (slightly past 1 during the eruption). */
  emerge: number
  /** Total bend at the tip, radians from vertical, towards `out`. */
  bend: number
  yaw: number
}

/** Tentacle at `tau` s into its cycle (0 = starts rising), sinking from `sinkAt`; `seed` sets it apart from the others. */
export function tentacleFrame(out: TentacleFrame, tau: number, sinkAt: number, seed: number): TentacleFrame {
  const T = KRAKEN_TENTACLE
  if (tau < 0) {
    out.emerge = 0
    out.bend = 0
    out.yaw = 0
    return out
  }
  const rise = tau / T.riseS
  out.emerge = tau < sinkAt ? erupt(rise) : erupt(Math.min(1, rise)) * (1 - smooth((tau - sinkAt) / T.sinkS))
  // A whip forward as it breaks the surface, then the sway.
  const sway = T.sway * Math.sin(tau * 1.9 + seed * 2.3) + 0.08 * Math.sin(tau * 3.7 + seed)
  let bend = sway - 0.6 * (1 - smooth(rise)) * Math.sin(rise * Math.PI)
  const fade = tau < sinkAt ? 1 : 1 - smooth((tau - sinkAt) / T.sinkS)
  for (const at of T.slams) {
    const start = at + seed * T.slamSpread
    if (start < sinkAt) bend += slamBend(tau - start) * fade
  }
  out.bend = bend
  out.yaw = 0.18 * Math.sin(tau * 0.8 + seed * 1.7)
  return out
}

/** Extra bend `t` s into one slam: wind back, strike over, hold on the water, recover. */
export function slamBend(t: number): number {
  const T = KRAKEN_TENTACLE
  if (t <= 0) return 0
  let k = t
  if (k < T.windupS) return T.windup * smooth(k / T.windupS)
  k -= T.windupS
  if (k < T.strikeS) return T.windup + (T.slam - T.windup) * (k / T.strikeS) ** 2
  k -= T.strikeS
  if (k < T.holdS) return T.slam
  k -= T.holdS
  if (k < T.recoverS) return T.slam * (1 - smooth(k / T.recoverS))
  return 0
}

export const SLAM_IMPACT_S = KRAKEN_TENTACLE.windupS + KRAKEN_TENTACLE.strikeS

/** Does `(prev, now]` contain an impact of one of tentacle `seed`'s slams that starts before `sinkAt`? */
export function slamImpactBetween(prev: number, now: number, sinkAt: number, seed: number): boolean {
  for (const at of KRAKEN_TENTACLE.slams) {
    const start = at + seed * KRAKEN_TENTACLE.slamSpread
    const impact = start + SLAM_IMPACT_S
    if (start < sinkAt && prev < impact && impact <= now) return true
  }
  return false
}

/** Segment k's base (u, y) and angle from vertical (theta); index `segments` is the tip. */
export interface Chain {
  u: Float32Array
  y: Float32Array
  theta: Float32Array
}

export function createChain(segments = KRAKEN_TENTACLE.segments): Chain {
  return { u: new Float32Array(segments + 1), y: new Float32Array(segments + 1), theta: new Float32Array(segments + 1) }
}

export function segmentRadius(k: number): number {
  const T = KRAKEN_TENTACLE
  return T.baseRadius + (T.tipRadius - T.baseRadius) * (k / T.segments)
}

/** The base sinks as `emerge` drops; the bend runs the whole length so a slam arcs it over onto the water. */
export function layChain(chain: Chain, emerge: number, bend: number): Chain {
  const { segments, segLen } = KRAKEN_TENTACLE
  const length = segments * segLen
  const curl = KRAKEN_TENTACLE.curl * (1 - smooth(bend / 1.6))
  let u = 0
  let y = -(1 - emerge) * length - 12
  for (let k = 0; k <= segments; k++) {
    const f = (k + 1) / segments
    const theta = bend * (0.6 * f + 0.4 * f * f) + curl * f * f * f
    chain.u[k] = u
    chain.y[k] = y
    chain.theta[k] = theta
    u += Math.sin(theta) * segLen
    y += Math.cos(theta) * segLen
  }
  return chain
}

export interface Spot {
  x: number
  z: number
  /** Unit horizontal direction away from the rider: slams fall this way, the sucker side faces back. */
  outX: number
  outZ: number
}

export interface SpotInput {
  index: TrackIndex
  groundFn: HeightFunction
  camera: Vec3
  forwardX: number
  forwardZ: number
  rng: Rng
  kind: 'tentacle' | 'head'
  taken: readonly Spot[]
  avoid: readonly { x: number; z: number; r: number }[]
}

function clear(input: SpotInput, x: number, z: number, radius: number): boolean {
  if (input.index.near(x, z, SPOTS.clearance + radius)) return false
  if (input.groundFn(x, z) > SPOTS.maxGround) return false
  return !input.avoid.some((a) => Math.hypot(a.x - x, a.z - z) < a.r + radius)
}

const SLAM_TURNS = [0, 0.9, -0.9]

/** A surfacing spot in front of the rider, clear of the track (also where the slam lands), in the water and off the stacks; false if none. */
export function pickSpot(out: Spot, input: SpotInput): boolean {
  const { camera, forwardX, forwardZ, rng, kind, taken } = input
  const range = SPOTS[kind]
  const head = kind === 'head'
  // The head's rim may hang over the shallows; most of it stays clear.
  const footprint = head ? KRAKEN_HEAD.rx * 0.65 : KRAKEN_TENTACLE.baseRadius
  for (let attempt = 0; attempt < SPOTS.attempts; attempt++) {
    const yaw = rng.range(-range.yaw, range.yaw)
    // Half the tries look further out, past a knot of the ride.
    const dist = rng.range(range.distMin, range.distMax) * (attempt < SPOTS.attempts / 2 ? 1 : 1.4)
    const nx = forwardX * Math.cos(yaw) - forwardZ * Math.sin(yaw)
    const nz = forwardX * Math.sin(yaw) + forwardZ * Math.cos(yaw)
    const x = camera.x + nx * dist
    const z = camera.z + nz * dist
    if (taken.some((s) => Math.hypot(s.x - x, s.z - z) < range.spacing)) continue
    if (!clear(input, x, z, footprint)) continue
    for (const turn of head ? [0] : SLAM_TURNS) {
      const c = Math.cos(turn)
      const s = Math.sin(turn)
      const outX = nx * c - nz * s
      const outZ = nx * s + nz * c
      if (!head && !slamClear(input, x, z, outX, outZ)) continue
      out.x = x
      out.z = z
      out.outX = outX
      out.outZ = outZ
      return true
    }
  }
  return false
}

function slamClear(input: SpotInput, x: number, z: number, outX: number, outZ: number): boolean {
  const reach = KRAKEN_TENTACLE.segments * KRAKEN_TENTACLE.segLen
  return clear(input, x + outX * reach * 0.5, z + outZ * reach * 0.5, 0) && clear(input, x + outX * reach * 0.9, z + outZ * reach * 0.9, 0)
}

export function behind(x: number, z: number, camera: Vec3, fx: number, fz: number): boolean {
  return (x - camera.x) * fx + (z - camera.z) * fz < 0
}

export interface HeadFrame {
  emerge: number
  y: number
}

export function headFrame(out: HeadFrame, tau: number, sinkAt: number, sinkS: number): HeadFrame {
  const H = KRAKEN_HEAD
  if (tau < 0) {
    out.emerge = 0
  } else {
    const up = erupt(Math.min(1, tau / H.riseS))
    out.emerge = tau < sinkAt ? up : up * (1 - smooth((tau - sinkAt) / sinkS))
  }
  out.y = -H.depth * (1 - out.emerge) + (tau > 0 ? Math.sin(tau * 1.3) * H.bob : 0)
  return out
}
