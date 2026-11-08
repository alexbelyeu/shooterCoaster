import { describe, expect, it } from 'vitest'
import { logoBeat } from './titleBeat'

const grid = { origin: 2, beatS: 0.5, beats: 4 }

describe('logo beat', () => {
  it('hits full on a bar line and lighter on the other beats', () => {
    expect(logoBeat(2, grid)).toBeCloseTo(1)
    expect(logoBeat(4, grid)).toBeCloseTo(1)
    expect(logoBeat(2.5, grid)).toBeCloseTo(0.35)
  })

  it('decays between beats and is silent before the music', () => {
    expect(logoBeat(2.45, grid)).toBeLessThan(0.2)
    expect(logoBeat(1, grid)).toBe(0)
    for (let t = 2; t < 10; t += 0.01) {
      const v = logoBeat(t, grid)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})
