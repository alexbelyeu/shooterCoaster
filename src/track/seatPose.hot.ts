import * as THREE from 'three'
import type { TrackCurve } from './curves/TrackCurve'
import type { ArcTable } from './arcLength'
import { type TrackSamples, lookAheadDirection, sampleTrack } from './cameraRig.hot'
import { seatUp } from './trackGeometry'
import { backwardsTurn, dropHeading, droppingOn, routeCurve } from './mechanics.hot'
import type { Route } from './mechanics'
import type { RideMechanic } from '@/types/level'

const WORLD_UP = new THREE.Vector3(0, 1, 0)
const turn = new THREE.Quaternion()

/** The rider's seat on the track: what `CoasterCamera` rides and the dev ride page (`rides.html`) poses. */
export interface SeatPose {
  eye: THREE.Vector3
  /** The rails' up (#698): the view's up, so an inversion turns the world over with no flip or snap. */
  up: THREE.Vector3
  tangent: THREE.Vector3
  /** Undamped look direction: the tangent eased toward the track `LOOK_AHEAD_UNITS` ahead. */
  look: THREE.Vector3
  samples: TrackSamples
  upAhead: THREE.Vector3
}

export function createSeatPose(): SeatPose {
  const v = () => new THREE.Vector3() // eslint-disable-line sc/no-hot-path-alloc -- cold: once per camera mount
  // eslint-disable-next-line sc/no-hot-path-alloc -- cold: once per camera mount
  const samples = { behindT: 0, aheadT: 0, lookT: 0, span: 0, unitsPerT: 0 }
  // eslint-disable-next-line sc/no-hot-path-alloc -- cold: once per camera mount
  return { eye: v(), up: v().set(0, 1, 0), tangent: v(), look: v(), samples, upAhead: v() }
}

/**
 * The seat at t: the eye `eyeHeight` along the rails' up (upside down, the rider hangs under the track). The track's
 * mechanics (#699) turn it: on a drop track it falls upright facing the drop's heading; on a backwards stretch it
 * faces back (turning round over a turntable's stop, `stopShare` through it, -1 when moving); on the run's `route` 'hard'
 * it rides a junction's branch through its span (#702).
 */
export function seatPose(
  curve: TrackCurve,
  table: ArcTable,
  t: number,
  trackScale: number,
  eyeHeight: number,
  out: SeatPose,
  mechanics?: readonly RideMechanic[],
  stopShare = -1,
  route: Route = 'easy',
): SeatPose {
  curve = routeCurve(curve, mechanics, route)
  out.tangent.copy(curve.getTangentAt(t))
  const at = sampleTrack(table, t, trackScale, out.samples)
  const drop = mechanics ? droppingOn(mechanics, t) : null
  if (drop) {
    out.up.copy(WORLD_UP)
    out.upAhead.copy(WORLD_UP)
    out.eye.copy(curve.getPointAt(t)).addScaledVector(out.up, eyeHeight)
    dropHeading(curve, drop, out.look)
    return out
  }
  seatUp(curve, t, out.up)
  out.eye.copy(curve.getPointAt(t)).addScaledVector(out.up, eyeHeight)
  seatUp(curve, at.lookT, out.upAhead)
  out.look.copy(curve.getPointAt(at.lookT)).addScaledVector(out.upAhead, eyeHeight).sub(out.eye).normalize()
  lookAheadDirection(out.tangent, out.look, out.look)
  const back = mechanics ? backwardsTurn(mechanics, t, stopShare) : 0
  if (back > 0) out.look.applyQuaternion(turn.setFromAxisAngle(out.up, Math.PI * back))
  return out
}
