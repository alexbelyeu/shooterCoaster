import { describe, expect, it } from 'vitest'
import { BALLOON_FLIGHT, balloonEscaped, balloonLift, balloonSway } from './balloonMotion.hot'

describe('balloon flight (#1059)', () => {
  it('settles without a jump and sways within its half-width either side', () => {
    expect(balloonSway(0, 1.2)).toBeCloseTo(0)
    let widest = 0
    for (let t = 0; t < 10; t += 0.05) widest = Math.max(widest, Math.abs(balloonSway(t, 1.2)))
    expect(widest).toBeGreaterThan(BALLOON_FLIGHT.sway)
    expect(widest).toBeLessThanOrEqual(2 * BALLOON_FLIGHT.sway)
  })

  it('lingers, then climbs away and escapes, unscored', () => {
    const { linger, flyOff } = BALLOON_FLIGHT
    expect(balloonLift(linger)).toBe(0)
    expect(balloonLift(linger + 1)).toBeGreaterThan(0)
    expect(balloonLift(linger + flyOff)).toBeGreaterThan(400)
    expect(balloonEscaped(linger + flyOff - 0.01)).toBe(false)
    expect(balloonEscaped(linger + flyOff)).toBe(true)
  })
})
