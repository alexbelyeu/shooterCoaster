import type { TrackParams } from '@/types/level'
import { createSplineCurve } from './SplineCurve'
import type { TrackCurve } from './TrackCurve'
import { createTrigCurve } from './TrigCurve'

/** The curve a level's track rides: the one `TrackParams` → curve factory. */
export function createTrackCurve(track: TrackParams): TrackCurve {
  if (track.curve === 'spline') return createSplineCurve(track.controlPoints)
  return createTrigCurve(track.varA, track.varB, track.varC, track.scalar)
}
