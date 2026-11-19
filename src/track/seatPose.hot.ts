import * as THREE from 'three'
import type { TrackCurve } from './curves/TrackCurve'
import type { ArcTable } from './arcLength'
import { type TrackSamples, lookAheadDirection, sampleTrack } from './cameraRig.hot'
import { seatUp } from './trackGeometry'

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

/** The seat at t: the eye `eyeHeight` along the rails' up (upside down, the rider hangs under the track). */
export function seatPose(curve: TrackCurve, table: ArcTable, t: number, trackScale: number, eyeHeight: number, out: SeatPose): SeatPose {
  out.tangent.copy(curve.getTangentAt(t))
  seatUp(curve, t, out.up)
  out.eye.copy(curve.getPointAt(t)).addScaledVector(out.up, eyeHeight)
  const at = sampleTrack(table, t, trackScale, out.samples)
  seatUp(curve, at.lookT, out.upAhead)
  out.look.copy(curve.getPointAt(at.lookT)).addScaledVector(out.upAhead, eyeHeight).sub(out.eye).normalize()
  lookAheadDirection(out.tangent, out.look, out.look)
  return out
}
