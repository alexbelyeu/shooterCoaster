import * as THREE from 'three'
import type { JunctionSpec } from '@/types/level'
import { createSplineCurve } from './curves/SplineCurve'
import type { TrackCurve } from './curves/TrackCurve'

/**
 * Shoot-to-switch junctions (#702), pure: a track with a second, harder way round one stretch. The main curve is the
 * easy route; `JunctionSpec.points` are the hard route's own points between the fork (`from`) and the merge (`to`).
 *
 * Both routes share the track's t: on the hard route, t in [from, to] is a point on the branch, so the ride's speed
 * rule, its profile and every timed beat run on the main curve's t and land on the same second whichever way the car
 * went. The branch is longer, so the car rides it faster; its arc is eased (`hermite`) so the car's speed matches the
 * main track's at the fork and the merge.
 */

/** Each end of the branch leads in along the main track for this share of the junction's span before it forks. */
const LEAD_SHARE = 0.08

export interface Junction {
  from: number
  to: number
  /** The hard route's stretch alone, its own t 0 → 1 from the fork to the merge (what `TrackMesh` lays the branch's rails on). */
  branch: TrackCurve
}

/** A curve that rides the hard route through the junction while `hard` is set; set it only while the car is outside [from, to]. */
export interface RoutedCurve extends TrackCurve {
  hard: boolean
}

/** Hermite ease from 0 to 1 with end slopes m0, m1: the branch's arc share at the junction's share u. */
function hermite(u: number, m0: number, m1: number): number {
  const u2 = u * u
  const u3 = u2 * u
  return (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) + (u3 - u2) * m1
}

const _a = new THREE.Vector3()

/** The main curve's speed |dP/dt| at t, measured across a small step. */
function speedAt(curve: TrackCurve, t: number): number {
  const h = 1e-4
  _a.copy(curve.getPointAt(t + h))
  return _a.distanceTo(curve.getPointAt(t - h)) / (2 * h)
}

export function buildJunction(main: TrackCurve, spec: JunctionSpec): Junction {
  const { from, to, points } = spec
  if (!(from > 0 && to < 1 && to > from)) throw new Error(`a junction needs 0 < from < to < 1, got ${from}…${to}`)
  if (main.getUpAt) throw new Error('a junction on a rolling track is not supported')
  const lead = (to - from) * LEAD_SHARE
  const at = (t: number) => {
    const p = main.getPointAt(t)
    return { x: p.x, y: p.y, z: p.z }
  }
  // A closed spline through the fork, the branch and the merge; its closing segment (merge back to fork) is never ridden.
  const knots = [at(from - lead), at(from), at(from + lead), ...points, at(to - lead), at(to), at(to + lead)]
  const spline = createSplineCurve(knots)
  const k0 = spline.knotT(1)
  const k1 = spline.knotT(knots.length - 2)
  let length = 0
  const prev = new THREE.Vector3().copy(spline.getPointAt(k0))
  for (let i = 1; i <= 512; i++) {
    const p = spline.getPointAt(k0 + ((k1 - k0) * i) / 512)
    length += p.distanceTo(prev)
    prev.copy(p)
  }
  const span = to - from
  const m0 = (speedAt(main, from) * span) / length
  const m1 = (speedAt(main, to) * span) / length
  // Fritsch–Carlson: slopes in (0, 3] keep the ease monotonic, so the car never rolls back on the branch.
  if (!(m0 > 0 && m0 <= 3 && m1 > 0 && m1 <= 3)) throw new Error(`junction ${from}…${to}: branch too short for the main track's speed`)
  const splineT = (u: number) => k0 + (k1 - k0) * hermite(Math.min(Math.max(u, 0), 1), m0, m1)
  const branch: TrackCurve = {
    getPointAt: (u) => spline.getPointAt(splineT(u)),
    getTangentAt: (u) => spline.getTangentAt(splineT(u)),
  }
  return { from, to, branch }
}

/** The switch sign stands this share of the junction's span before the fork. */
const SIGN_LEAD_SHARE = 0.1
/** Beside the track toward the branch's side, and up, in eye heights. */
const SIGN_OUT = 4.5
const SIGN_UP = 3

export interface SwitchPose {
  /** Track t where the sign stands: the switch can be set until the car reaches it. */
  t: number
  position: THREE.Vector3
  /** Heading of the board's face (radians about world up): it faces the oncoming car. */
  yaw: number
  /** +1 when the branch forks to the car's right, −1 to its left. */
  side: 1 | -1
}

/** Where the switch sign stands: just before the fork, out on the side the branch goes, facing the oncoming car. */
export function switchPose(main: TrackCurve, junction: Junction, eyeHeight: number): SwitchPose {
  const { from, to, branch } = junction
  const t = from - (to - from) * SIGN_LEAD_SHARE
  const tangent = new THREE.Vector3().copy(main.getTangentAt(t))
  const right = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize()
  const off = new THREE.Vector3().copy(branch.getPointAt(0.5)).sub(main.getPointAt((from + to) / 2))
  const side = off.dot(right) >= 0 ? 1 : -1
  const position = new THREE.Vector3()
    .copy(main.getPointAt(t))
    .addScaledVector(right, side * SIGN_OUT * eyeHeight)
    .add(new THREE.Vector3(0, SIGN_UP * eyeHeight, 0))
  return { t, position, yaw: Math.atan2(-tangent.x, -tangent.z), side }
}

/** The switch takes a hit only while the car is still short of the sign (one fork per lap, never mid-junction). */
export function switchOpen(rideT: number, pose: SwitchPose): boolean {
  return rideT - Math.floor(rideT) < pose.t
}

/** The track as the car rides it: the main curve, or the junction's branch through [from, to] while `hard`. */
export function routedCurve(main: TrackCurve, junction: Junction): RoutedCurve {
  const { from, to, branch } = junction
  const span = to - from
  const onBranch = (t: number) => {
    const w = t - Math.floor(t)
    return w >= from && w <= to
  }
  const curve: RoutedCurve = {
    hard: false,
    getPointAt: (t) => (curve.hard && onBranch(t) ? branch.getPointAt((t - Math.floor(t) - from) / span) : main.getPointAt(t)),
    getTangentAt: (t) => (curve.hard && onBranch(t) ? branch.getTangentAt((t - Math.floor(t) - from) / span) : main.getTangentAt(t)),
  }
  return curve
}
