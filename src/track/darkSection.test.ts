import { describe, expect, it } from 'vitest'
import { darkSectionDepth } from './darkSection.hot'

const cave = { from: 0.3, to: 0.4, ramp: 0.02, flashReach: 100 }

describe('darkSectionDepth', () => {
  it('is 0 without sections and outside them', () => {
    expect(darkSectionDepth(undefined, 0.35)).toBe(0)
    expect(darkSectionDepth([], 0.35)).toBe(0)
    expect(darkSectionDepth([cave], 0.29)).toBe(0)
    expect(darkSectionDepth([cave], 0.41)).toBe(0)
  })

  it('eases in over the ramp, holds fully dark, eases out before the end', () => {
    expect(darkSectionDepth([cave], 0.3)).toBe(0)
    expect(darkSectionDepth([cave], 0.31)).toBeCloseTo(0.5, 6)
    expect(darkSectionDepth([cave], 0.32)).toBe(1)
    expect(darkSectionDepth([cave], 0.35)).toBe(1)
    expect(darkSectionDepth([cave], 0.39)).toBeCloseTo(0.5, 6)
    expect(darkSectionDepth([cave], 0.4)).toBe(0)
  })

  it('rises monotonically through the ramp', () => {
    const depths = Array.from({ length: 21 }, (_, i) => darkSectionDepth([cave], 0.3 + (i / 20) * cave.ramp))
    expect(depths.every((d, i) => i === 0 || d >= depths[i - 1])).toBe(true)
  })

  it('finds the section the ride is in among several', () => {
    const later = { from: 0.7, to: 0.8, ramp: 0.01, flashReach: 100 }
    expect(darkSectionDepth([cave, later], 0.75)).toBe(1)
    expect(darkSectionDepth([cave, later], 0.5)).toBe(0)
  })
})
