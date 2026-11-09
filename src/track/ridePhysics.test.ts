import { describe, expect, it } from 'vitest'
import { getAllLevels } from '@/levels/LevelRegistry'
import { createTrigCurve } from './curves/TrigCurve'
import { createTrigCurve2 } from './curves/TrigCurve2'
import { buildArcTable } from './arcLength'
import { RUN_SECONDS } from '@/levels/pacing'
import { advanceRide, lapSeconds, nextVelocity, rideProfile, rideSpeeds, riddenBetween } from './ridePhysics'
import type { TrackCurve } from './curves/TrackCurve'

describe('nextVelocity', () => {
  const speeds = { roll: 0.001, min: 0.01, max: 0.05 }

  it('speeds up downhill, slows uphill, within the ride speeds', () => {
    expect(nextVelocity(0.02, -0.5, 1, speeds)).toBeCloseTo(0.0205)
    expect(nextVelocity(0.02, 0.5, 1, speeds)).toBeCloseTo(0.0195)
    expect(nextVelocity(0, 0, 1, speeds)).toBe(speeds.min)
    expect(nextVelocity(0.05, -1, 3, speeds)).toBe(speeds.max)
  })
})

describe.each(getAllLevels().map((l) => [l.id, l] as const))('%s rideProfile', (_id, level) => {
  const factory = level.track.curve === 'curve2' ? createTrigCurve2 : createTrigCurve
  const table = buildArcTable(factory(level.track.varA, level.track.varB, level.track.varC, level.track.scalar))
  const speeds = rideSpeeds(level.track)
  const profile = rideProfile(table, speeds, RUN_SECONDS)

  it('rides forward every tenth of a second, between the min and max speed', () => {
    const minStep = (speeds.min * 60 * table.length) / 10
    const maxStep = (speeds.max * 60 * table.length) / 10
    for (let k = 2; k < profile.length; k++) {
      const step = profile[k] - profile[k - 1]
      expect(step).toBeGreaterThanOrEqual(minStep - 1e-6)
      expect(step).toBeLessThanOrEqual(maxStep + 1e-6)
    }
  })

  it('measures the arc between two level times, clamped to the run', () => {
    const half = RUN_SECONDS / 2
    expect(riddenBetween(profile, 0, RUN_SECONDS)).toBeCloseTo(riddenBetween(profile, 0, half) + riddenBetween(profile, half, RUN_SECONDS))
    expect(riddenBetween(profile, half, half)).toBe(0)
    expect(riddenBetween(profile, half, 0)).toBe(0)
    expect(riddenBetween(profile, RUN_SECONDS, RUN_SECONDS + 10)).toBe(0)
  })
})

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
