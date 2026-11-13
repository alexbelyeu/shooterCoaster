import type { TrackParams } from '@/types/level'
import { createSplineCurve } from './SplineCurve'
import type { TrackCurve } from './TrackCurve'
import { createTrigCurve } from './TrigCurve'
import { createTrigCurve2 } from './TrigCurve2'

/** The curve a level's track rides. */
export function createTrackCurve(track: TrackParams): TrackCurve {
  if (track.curve === 'spline') {
    if (!track.controlPoints) throw new Error('a spline track needs controlPoints')
    return createSplineCurve(track.controlPoints)
  }
  const factory = track.curve === 'curve2' ? createTrigCurve2 : createTrigCurve
  return factory(track.varA, track.varB, track.varC, track.scalar)
}
