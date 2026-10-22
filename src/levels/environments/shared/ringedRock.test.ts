import { describe, expect, it } from 'vitest'
import { profileRadiusAt } from './ringedRock'

describe('profileRadiusAt', () => {
  it('interpolates between rings and clamps at the ends', () => {
    const rings = [
      { y: 0, r: 10 },
      { y: 10, r: 6 },
      { y: 10, r: 4 },
      { y: 20, r: 2 },
    ]
    expect(profileRadiusAt(rings, -5)).toBe(10)
    expect(profileRadiusAt(rings, 5)).toBeCloseTo(8)
    expect(profileRadiusAt(rings, 15)).toBeCloseTo(3)
    expect(profileRadiusAt(rings, 30)).toBe(2)
  })
})
