import * as THREE from 'three'
import type { RideMechanic } from '@/types/level'
import type { TrackCurve } from './curves/TrackCurve'
import { type Route, hardRouteOf } from './mechanics'

// `dist` is the car's arc distance into the lap (`distanceAtT` of its `t`) and `length` the lap's. A mechanic's ends are
// compared by distance, where the ride plan stops, never by `t`, which the arc table rounds off an end (#719).
// `stopShare` is `planStopShare` (-1 moving).

/** A stop lands the car on its turntable to within this share of the lap. */
const AT_STOP = 1e-4
/** World units within which the car is on a mechanic's end: above the arc table's round trip, far below a frame's ride. */
const AT_END = 1e-6

/** The seat's turn about its up, 0 facing forward to 1 facing back: round on the first turntable, back on the second. */
export function backwardsTurn(mechanics: readonly RideMechanic[], dist: number, length: number, stopShare: number): number {
  for (const m of mechanics) {
    if (m.kind !== 'backwards') continue
    const from = m.from * length
    const to = m.to * length
    if (dist < from - AT_STOP * length || dist > to + AT_STOP * length) continue
    if (stopShare >= 0) return Math.abs(dist - from) < Math.abs(dist - to) ? stopShare : 1 - stopShare
    // Moving on an end, the car is arriving at its stop (it leaves one only past it): still forward on the first, still back on the second.
    return dist > from + AT_END && dist < to + AT_END ? 1 : 0
  }
  return 0
}

/** The drop track the car is on, from stopped at its top to the track below, or null. */
export function droppingOn(mechanics: readonly RideMechanic[], dist: number, length: number): RideMechanic | null {
  for (const m of mechanics) if (m.kind === 'dropTrack' && dist >= m.from * length - AT_END && dist <= m.to * length) return m
  return null
}

/** The drop's heading: the track's at its top, level. */
export function dropHeading(curve: TrackCurve, drop: RideMechanic, out: THREE.Vector3): THREE.Vector3 {
  out.copy(curve.getTangentAt(drop.from))
  out.y = 0
  return out.normalize()
}

/** The drop's piece: under the car as it falls, at the bottom until the car is off it (`pieceShare`: half of it), else at the top. */
export function dropPiecePosition(curve: TrackCurve, drop: RideMechanic, t: number, pieceShare: number, out: THREE.Vector3): THREE.Vector3 {
  if (t >= drop.from && t <= drop.to) return out.copy(curve.getPointAt(t))
  if (t > drop.to && t <= drop.to + pieceShare) return out.copy(curve.getPointAt(drop.to))
  return out.copy(curve.getPointAt(drop.from))
}

/** The curve the seat rides on `route`: the main track, or on the hard way the junctions' branches through their spans. */
export function routeCurve(main: TrackCurve, mechanics: readonly RideMechanic[] | undefined, route: Route): TrackCurve {
  if (route === 'easy' || !mechanics) return main
  return hardRouteOf(main, mechanics) ?? main
}

const _p = new THREE.Vector3()
const SPEED_STEP = 1e-4

/** How much faster the seat moves per t on `seat` than on `main` at t (1 off a branch): the branch's g-forces scale by it. */
export function routeSpeedScale(main: TrackCurve, seat: TrackCurve, t: number): number {
  if (seat === main) return 1
  _p.copy(seat.getPointAt(t + SPEED_STEP))
  const along = _p.distanceTo(seat.getPointAt(t - SPEED_STEP))
  _p.copy(main.getPointAt(t + SPEED_STEP))
  const base = _p.distanceTo(main.getPointAt(t - SPEED_STEP))
  return base > 0 ? along / base : 1
}
