import { describe, expect, it } from 'vitest'
import { getAllLevels } from '@/levels/LevelRegistry'
import { createTrigCurve } from './curves/TrigCurve'
import { createTrigCurve2 } from './curves/TrigCurve2'
import { buildArcTable } from './arcLength'
import { nextVelocity, rideProfile, rideSpeeds, riddenBetween } from './ridePhysics'

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
  const profile = rideProfile(table, speeds, level.timerSeconds)

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
    const half = level.timerSeconds / 2
    expect(riddenBetween(profile, 0, level.timerSeconds)).toBeCloseTo(riddenBetween(profile, 0, half) + riddenBetween(profile, half, level.timerSeconds))
    expect(riddenBetween(profile, half, half)).toBe(0)
    expect(riddenBetween(profile, half, 0)).toBe(0)
    expect(riddenBetween(profile, level.timerSeconds, level.timerSeconds + 10)).toBe(0)
  })
})
