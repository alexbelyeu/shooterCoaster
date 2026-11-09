import { describe, expect, it } from 'vitest'
import { createTrigCurve } from './curves/TrigCurve'
import { createTrigCurve2 } from './curves/TrigCurve2'
import { getAllLevels } from '@/levels/LevelRegistry'
import { RUN_SECONDS } from '@/levels/pacing'
import { advanceRide, lapSeconds, rideSpeeds } from './ridePhysics'
import type { TrackCurve } from './curves/TrackCurve'

const flat: TrackCurve = {
  getPointAt: () => ({ x: 0, y: 0, z: 0 }) as never,
  getTangentAt: () => ({ x: 1, y: 0, z: 0 }) as never,
}

describe('advanceRide', () => {
  const speeds = rideSpeeds({ rollerSpeed: 0.00001, minRollerSpeed: 0.0001 })

  it('a standing car picks up the minimum speed, holds it on the flat and wraps past 1', () => {
    const state = advanceRide({ progress: 0.9999, velocity: 0 }, flat, speeds, 1)
    expect(state).toEqual({ progress: 0.9999, velocity: speeds.min })
    advanceRide(state, flat, speeds, 3)
    expect(state.progress).toBeCloseTo(0.9999 + 3 * speeds.min - 1, 10)
  })

  it('rides a long step in steps of at most 3 frames, and caps the speed downhill', () => {
    const downhill: TrackCurve = { ...flat, getTangentAt: () => ({ x: 0, y: -1, z: 0 }) as never }
    const state = advanceRide({ progress: 0, velocity: speeds.min }, downhill, speeds, 1e6)
    expect(state.velocity).toBe(speeds.max)
    expect(speeds.max / speeds.min).toBe(5)
  })
})

/** Pinned (#452): a 60 s lap would ride 2.2–3.8× faster than today, a different ride, so a run rides 0.25–0.6 of a lap. */
const LAPS: Record<string, number> = { level1: 147, level2: 165, level3: 99, level4: 193, level5: 228 }

describe.each(getAllLevels().map((l) => [l.id, l.track] as const))('the ride on %s', (id, track) => {
  it('laps in its pinned time, longer than a run', () => {
    const curve = (track.curve === 'curve2' ? createTrigCurve2 : createTrigCurve)(track.varA, track.varB, track.varC, track.scalar)
    const lap = lapSeconds(curve, rideSpeeds(track))
    expect(lap).toBeGreaterThan(RUN_SECONDS)
    expect(Math.abs(lap - LAPS[id])).toBeLessThan(1)
  })
})
