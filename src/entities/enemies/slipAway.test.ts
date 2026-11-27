import { describe, expect, it } from 'vitest'
import { CROW_FLEE, SAND_BURROW, SNOW_SINK, TOUCAN_FLEE, slipOffset, slipped } from './slipAway.hot'

describe('enemies slip away once seen (#1059)', () => {
  it.each([['snow', SNOW_SINK], ['sand', SAND_BURROW], ['crow', CROW_FLEE], ['toucan', TOUCAN_FLEE]] as const)(
    '%s: stays while it lingers, then goes its whole distance and is gone, unscored',
    (_, s) => {
      const { linger, goS, distance } = s
      expect(slipOffset(s, 0)).toBe(0)
      expect(slipOffset(s, linger)).toBe(0)
      expect(slipOffset(s, linger + goS / 2)).toBeGreaterThan(0)
      expect(slipOffset(s, linger + goS / 2)).toBeLessThan(distance / 2)
      expect(slipOffset(s, linger + goS)).toBeCloseTo(distance)
      expect(slipped(s, linger + goS - 0.01)).toBe(false)
      expect(slipped(s, linger + goS)).toBe(true)
    },
  )
})
