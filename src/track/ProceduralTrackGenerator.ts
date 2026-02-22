import { createTrigCurve } from './curves/TrigCurve'
import { createTrigCurve2 } from './curves/TrigCurve2'
import type { TrackCurve } from './curves/TrackCurve'

/**
 * Phase 8: Seeded random track generator for Endless mode.
 * Given a seed, generates deterministic TrigCurve parameters.
 */

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

export interface ProceduralSegment {
  curve: TrackCurve
  varA: number
  varB: number
  varC: number
  scalar: number
}

export function generateTrackSegment(seed: number, segmentIndex: number): ProceduralSegment {
  const rng = seededRandom(seed + segmentIndex * 7919)

  const varA = Math.floor(rng() * 6) + 2    // 2-7
  const varB = Math.floor(rng() * 25) + 10  // 10-34
  const varC = Math.floor(rng() * 4) + 2    // 2-5
  const scalar = Math.floor(rng() * 40) + 20 // 20-59

  const useCurve2 = rng() > 0.7
  const factory = useCurve2 ? createTrigCurve2 : createTrigCurve
  const curve = factory(varA, varB, varC, scalar)

  return { curve, varA, varB, varC, scalar }
}

export function generateEndlessTrack(seed: number, segmentCount: number): ProceduralSegment[] {
  const segments: ProceduralSegment[] = []
  for (let i = 0; i < segmentCount; i++) {
    segments.push(generateTrackSegment(seed, i))
  }
  return segments
}
