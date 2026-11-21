import * as THREE from 'three'
import type { RideHold, RideMechanic, RideV2Spec, SpeedZone } from '@/types/level'
import { RIDE_V2_DEFAULTS } from './rideV2'
import { createSplineCurve } from './curves/SplineCurve'
import type { TrackCurve } from './curves/TrackCurve'
import { buildArcTable, type ArcTable } from './arcLength'

/** What the special ride mechanics (#699) ask of the v2 ride (zones and stops) and of the rails (where they are open). */

/** World units of brake run before a stop (a drop track's top, a turntable): it brakes as late as it can to the crawl. */
export const STOP_APPROACH = 80
/** World units the launch out of a turntable pushes over. */
export const TURNTABLE_LAUNCH = 90

/** The drop track's piece, the car's length of track that falls with it, in world units at an eye height. */
export function dropPieceLength(eyeHeight: number): number {
  return eyeHeight * 3
}

function checkMechanic(m: RideMechanic): void {
  if (!(m.from >= 0 && m.from < m.to && m.to < 1)) throw new Error(`${m.kind}: from and to must be shares of the lap with from < to`)
  if (m.kind === 'station' && m.from !== 0) throw new Error('station: the ride starts in it, so it must be at 0')
  if (m.kind === 'jumpGap' && !(m.boostFrom < m.from)) throw new Error('jumpGap: its booster must come before the lip')
  if ((m.kind === 'dropTrack' || m.kind === 'backwards') && !(m.from > 0 && m.seconds > 0)) {
    throw new Error(`${m.kind}: a stop inside the lap that lasts`)
  }
  if (m.kind === 'junction' && !m.points.length) throw new Error('junction: needs points, a way round')
  // The sign stands before the fork: before 0 it would never take a hit (`switchOpen`) and the overlap check would miss the lap's end.
  if (m.kind === 'junction' && !(switchShare(m) > 0)) throw new Error(`junction ${m.from}…${m.to}: its switch sign falls before the lap's start (t ${switchShare(m).toFixed(3)})`)
}

/** Where a mechanic starts taking over the ride: a jump's booster, a junction's switch sign, else its `from`. */
function reachFrom(m: RideMechanic): number {
  if (m.kind === 'jumpGap') return m.boostFrom
  if (m.kind === 'junction') return switchShare(m)
  return m.from
}

/**
 * Each mechanic valid, at most one junction (the run has one `route` and the switch one collision target), and no junction
 * (from its sign to its merge) over another mechanic: the branch's seat has none of theirs.
 */
export function checkMechanics(mechanics: readonly RideMechanic[] | undefined): void {
  for (const m of mechanics ?? []) checkMechanic(m)
  if ((mechanics ?? []).filter((m) => m.kind === 'junction').length > 1) throw new Error('one junction per track: the run has a single route')
  for (const j of mechanics ?? []) {
    if (j.kind !== 'junction') continue
    for (const m of mechanics ?? []) {
      if (m !== j && reachFrom(m) < j.to && reachFrom(j) < m.to) throw new Error(`junction ${j.from}…${j.to} overlaps the ${m.kind} at ${m.from}…${m.to}`)
    }
  }
}

/** Brake to the crawl into `at`, hold `seconds`, then (with `speed`) launch out over `launch` units. */
function stopAt(at: number, seconds: number, length: number, crawl: number, speed?: number, launch = 0): { zones: SpeedZone[]; hold: RideHold } {
  const zones: SpeedZone[] = [{ kind: 'brake', from: Math.max(at - STOP_APPROACH / length, 0), to: at, speed: crawl, stop: true }]
  if (speed) zones.push({ kind: 'launch', from: at, to: at + launch / length, speed })
  return { zones, hold: { at, seconds } }
}

/** `spec` with its mechanics' zones and stops, ahead of its own zones (the first zone over a stretch drives it). */
export function withMechanics(spec: RideV2Spec, mechanics: readonly RideMechanic[] | undefined, length: number): RideV2Spec {
  if (!mechanics?.length) return spec
  const crawl = spec.crawl ?? RIDE_V2_DEFAULTS.crawl
  const gravity = spec.gravity ?? RIDE_V2_DEFAULTS.gravity
  const zones: SpeedZone[] = []
  const holds: RideHold[] = []
  const stop = (s: { zones: SpeedZone[]; hold: RideHold }) => {
    zones.push(...s.zones)
    holds.push(s.hold)
  }
  checkMechanics(mechanics)
  for (const m of mechanics) {
    switch (m.kind) {
      case 'station':
        zones.push({ kind: 'launch', from: m.from, to: m.to, speed: m.speed })
        break
      case 'dropTrack':
        stop(stopAt(m.from, m.seconds, length, crawl))
        break
      case 'jumpGap': {
        // Twice gravity out-pushes the ramp's climb, so the car leaves the lip at the speed its arc was built for.
        const mid = (m.boostFrom + m.from) / 2
        zones.push({ kind: 'brake', from: m.boostFrom, to: mid, speed: m.speed })
        zones.push({ kind: 'launch', from: mid, to: m.from, speed: m.speed, accel: gravity * 2 })
        break
      }
      case 'backwards': {
        const launch = Math.max(Math.min(TURNTABLE_LAUNCH, ((m.to - m.from) * length - STOP_APPROACH) / 2), 0)
        stop(stopAt(m.from, m.seconds, length, crawl, m.speed, launch))
        stop(stopAt(m.to, m.seconds, length, crawl, m.speed, Math.min(TURNTABLE_LAUNCH, (1 - m.to) * length)))
        break
      }
      case 'junction':
        // Both ways round share the ride's timing (`buildJunction`): no zones.
        break
    }
  }
  return { ...spec, zones: [...zones, ...(spec.zones ?? [])], holds: [...holds, ...(spec.holds ?? [])] }
}

/** Arc-distance spans with no rails, ties or towers: a jump's flight, a drop's shaft plus its piece at both ends. */
export function trackGaps(mechanics: readonly RideMechanic[] | undefined, length: number, pieceLength: number): [number, number][] {
  const gaps: [number, number][] = []
  for (const m of mechanics ?? []) {
    if (m.kind === 'jumpGap') gaps.push([m.from * length, m.to * length])
    else if (m.kind === 'dropTrack') gaps.push([m.from * length - pieceLength / 2, m.to * length + pieceLength / 2])
  }
  return gaps
}

// ── Shoot-to-switch junctions (#702) ──
// Both routes share the track's t (an arc share on a spline): on the hard route, t in [from, to] is a point on the branch, so
// the ride's speed rule, its profile and every timed beat run on the main curve and land on the same second whichever way the
// car went. The branch is longer, so the car rides it faster; its arc is eased (`hermite`) so the car's speed matches the
// main track's at the fork and the merge.

export type JunctionMechanic = Extract<RideMechanic, { kind: 'junction' }>
export type Route = 'easy' | 'hard'

/** Each end of the branch leads in along the main track for this share of the junction's span before it forks. */
const LEAD_SHARE = 0.08
/** The switch sign stands this share of the junction's span before the fork. */
const SIGN_LEAD_SHARE = 0.1
/** Beside the track toward the branch's side, and up, in eye heights. */
const SIGN_OUT = 4.5
const SIGN_UP = 3
/** The sign's board, in eye heights. */
export const SWITCH_BOARD_W = 6
export const SWITCH_BOARD_H = 3.6
/** The switch's hit sphere round the board's centre, in eye heights: half the board's height, so nothing above or below it hits. */
export const SWITCH_HIT_RADIUS = SWITCH_BOARD_H / 2

export interface Junction {
  from: number
  to: number
  /** The hard route's stretch alone, its own t 0 → 1 from the fork to the merge (what `TrackMesh` lays the branch's rails on). */
  branch: TrackCurve
}

/** Hermite ease from 0 to 1 with end slopes m0, m1: the branch's arc share at the junction's share u. */
function hermite(u: number, m0: number, m1: number): number {
  const u2 = u * u
  const u3 = u2 * u
  return (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) + (u3 - u2) * m1
}

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _up = new THREE.Vector3()
/** A rolling track's up at a fork or merge within 2° of unrolled: the unrolled branch meets it with no visible twist. */
const UNROLLED_COS = Math.cos((2 * Math.PI) / 180)

/** The unrolled up at a tangent (world up made perpendicular to it): what a track without `getUpAt` rides. */
export function unrolledUp(tangent: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  return out.set(0, 1, 0).addScaledVector(tangent, -tangent.y).normalize()
}

/** The main curve's speed |dP/dt| at t, measured across a small step. */
function speedAt(curve: TrackCurve, t: number): number {
  const h = 1e-4
  _a.copy(curve.getPointAt(t + h))
  return _a.distanceTo(curve.getPointAt(t - h)) / (2 * h)
}

export function buildJunction(main: TrackCurve, m: JunctionMechanic): Junction {
  checkMechanic(m)
  const { from, to, points } = m
  if (!('knotT' in main)) throw new Error('a junction needs a spline track: its from and to are arc shares')
  const lead = (to - from) * LEAD_SHARE
  // The branch is never rolled: on a track that rolls, it forks and merges where the main track runs unrolled too.
  if (main.getUpAt) {
    for (const t of [from - lead, from, to, to + lead]) {
      if (main.getUpAt(t).dot(unrolledUp(main.getTangentAt(t), _b)) < UNROLLED_COS) throw new Error(`junction ${from}…${to}: the track rolls at its fork or merge`)
    }
  }
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

const built = new WeakMap<JunctionMechanic, { main: TrackCurve; junction: Junction }>()

/** `buildJunction`, once per mechanic and main curve (the seat, the rails and the sign share it). */
export function junctionOf(main: TrackCurve, m: JunctionMechanic): Junction {
  const hit = built.get(m)
  if (hit?.main === main) return hit.junction
  const junction = buildJunction(main, m)
  built.set(m, { main, junction })
  return junction
}

const hardRoutes = new WeakMap<readonly RideMechanic[], { main: TrackCurve; curve: TrackCurve | null }>()

/** The junction whose span holds t (wrapped to the lap), or null. */
function junctionAt(junctions: readonly Junction[], t: number): Junction | null {
  const w = t - Math.floor(t)
  for (const j of junctions) if (w >= j.from && w <= j.to) return j
  return null
}

/**
 * The hard route as one curve, built once per track and mechanics (null without a junction): `main`, except through each
 * junction's span, where it is that junction's branch. What the seat rides once the switch is shot (`routeCurve`).
 */
export function hardRouteOf(main: TrackCurve, mechanics: readonly RideMechanic[]): TrackCurve | null {
  const hit = hardRoutes.get(mechanics)
  if (hit?.main === main) return hit.curve
  const junctions = mechanics.flatMap((m) => (m.kind === 'junction' ? [junctionOf(main, m)] : []))
  const branchT = (j: Junction, t: number) => (t - Math.floor(t) - j.from) / (j.to - j.from)
  const curve: TrackCurve | null = junctions.length
    ? {
      getPointAt: (t) => {
        const j = junctionAt(junctions, t)
        return j ? j.branch.getPointAt(branchT(j, t)) : main.getPointAt(t)
      },
      getTangentAt: (t) => {
        const j = junctionAt(junctions, t)
        return j ? j.branch.getTangentAt(branchT(j, t)) : main.getTangentAt(t)
      },
    }
    : null
  // On a track that rolls, the hard route takes its up from the main track outside the spans, the unrolled up on a branch.
  const mainUp = main.getUpAt
  if (curve && mainUp) {
    curve.getUpAt = (t) => {
      const j = junctionAt(junctions, t)
      return j ? unrolledUp(j.branch.getTangentAt(branchT(j, t)), _up) : mainUp(t)
    }
  }
  hardRoutes.set(mechanics, { main, curve })
  return curve
}

/**
 * The hard route of a track with a junction (#720): its own arc table, which samples t like the main one (both routes
 * share the ride's t), so a rider's sample index is the same on either; the track t of the switch sign, where the route
 * is settled; and of the junction's merge.
 */
export interface HardRoute {
  table: ArcTable
  signT: number
  mergeT: number
}

/** The track's `HardRoute`, or null without a junction. */
export function hardRouteFor(main: TrackCurve, mechanics: readonly RideMechanic[] | undefined): HardRoute | null {
  const junction = mechanics?.find((m) => m.kind === 'junction')
  const curve = junction && hardRouteOf(main, mechanics!)
  return curve ? { table: buildArcTable(curve), signT: switchShare(junction), mergeT: junction.to } : null
}

/** Track t where the switch sign stands: the switch can be set until the car reaches it. */
export function switchShare(m: { from: number; to: number }): number {
  return m.from - (m.to - m.from) * SIGN_LEAD_SHARE
}

export interface SwitchPose {
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
  const t = switchShare(junction)
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
