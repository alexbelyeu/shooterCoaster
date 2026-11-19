import type { TrackParams } from '@/types/level'
import { createSplineCurve } from './SplineCurve'
import type { TrackCurve } from './TrackCurve'
import { createTrigCurve } from './TrigCurve'
import { createTrigCurve2 } from './TrigCurve2'

/** The curve a level's track rides: the one `TrackParams` → curve factory. */
export function createTrackCurve(track: TrackParams): TrackCurve {
  if (track.curve === 'spline') return createSplineCurve(track.controlPoints)
  const factory = track.curve === 'curve2' ? createTrigCurve2 : createTrigCurve
  return factory(track.varA, track.varB, track.varC, track.scalar)
}
