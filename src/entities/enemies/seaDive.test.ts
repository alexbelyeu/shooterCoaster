import { describe, expect, it } from 'vitest'
import { SEA_DIVE, diveProgress, type DiveClock } from './seaDive.hot'

const STAY = 5
/** The camera looks down -z. */
const ahead = (clock: DiveClock, t: number, dz = -500, dx = 0) => diveProgress(clock, t, STAY, dx, 0, dz, 0, 0, -1)

describe('sea dive (#1059)', () => {
  it('waits while the rider has not seen it: behind, off to the side or out of range', () => {
    const clock = { seenAt: -1 }
    expect(diveProgress(clock, 10, STAY, 0, 0, 500, 0, 0, -1)).toBe(0)
    expect(ahead(clock, 20, -100, 400)).toBe(0)
    expect(ahead(clock, 30, -(SEA_DIVE.range + 10))).toBe(0)
    expect(clock.seenAt).toBe(-1)
  })

  it('stays its time once seen, then dives under in diveS and is gone, whether or not the rider still looks', () => {
    const clock = { seenAt: -1 }
    expect(ahead(clock, 3)).toBe(0)
    expect(clock.seenAt).toBe(3)
    expect(diveProgress(clock, 3 + STAY, STAY, 0, 0, 500, 0, 0, -1)).toBe(0)
    expect(diveProgress(clock, 3 + STAY + SEA_DIVE.diveS / 2, STAY, 0, 0, 500, 0, 0, -1)).toBeCloseTo(0.5)
    expect(ahead(clock, 3 + STAY + SEA_DIVE.diveS)).toBeGreaterThanOrEqual(1)
  })
})
