import { describe, expect, it } from 'vitest'
import { SEA_DIVE, diveProgress } from './seaDive.hot'

const STAY = 5

describe('sea dive (#1059)', () => {
  it('waits while the rider has not seen it, then stays its time', () => {
    expect(diveProgress(-1, STAY)).toBe(0)
    expect(diveProgress(0, STAY)).toBe(0)
    expect(diveProgress(STAY, STAY)).toBe(0)
  })

  it('dives under in diveS once its stay is up, and is gone', () => {
    expect(diveProgress(STAY + SEA_DIVE.diveS / 2, STAY)).toBeCloseTo(0.5)
    expect(diveProgress(STAY + SEA_DIVE.diveS * 1.01, STAY)).toBeGreaterThanOrEqual(1)
  })
})
