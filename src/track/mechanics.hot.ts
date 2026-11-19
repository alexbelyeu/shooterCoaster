import * as THREE from 'three'
import type { RideMechanic } from '@/types/level'
import type { TrackCurve } from './curves/TrackCurve'

// `t` is the car's track parameter, a spline's arc share like the mechanics'; `stopShare` is `planStopShare` (-1 moving).

/** A stop lands the car on its turntable to within this share of the lap. */
const AT_STOP = 1e-4

/** The seat's turn about its up, 0 facing forward to 1 facing back: round on the first turntable, back on the second. */
export function backwardsTurn(mechanics: readonly RideMechanic[], t: number, stopShare: number): number {
  for (const m of mechanics) {
    if (m.kind !== 'backwards' || t < m.from - AT_STOP || t > m.to + AT_STOP) continue
    if (stopShare >= 0) return Math.abs(t - m.from) < Math.abs(t - m.to) ? stopShare : 1 - stopShare
    return t > m.from && t < m.to ? 1 : 0
  }
  return 0
}

/** The drop track the car is falling on (from its top to the track below), or null. */
export function droppingOn(mechanics: readonly RideMechanic[], t: number): RideMechanic | null {
  for (const m of mechanics) if (m.kind === 'dropTrack' && t >= m.from && t <= m.to) return m
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
