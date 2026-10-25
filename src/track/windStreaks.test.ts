import { describe, expect, it } from 'vitest'
import {
  STREAK_COUNT, STREAK_MAX_OPACITY, STREAK_SPEED_THRESHOLD, streakLayout, streakOpacity, streakRate,
} from './windStreaks'

describe('streakOpacity', () => {
  it('is 0 up to the speed threshold and peaks at top speed', () => {
    expect(streakOpacity(0, 1)).toBe(0)
    expect(streakOpacity(STREAK_SPEED_THRESHOLD, 1)).toBe(0)
    expect(streakOpacity(1, 1)).toBeCloseTo(STREAK_MAX_OPACITY, 9)
    const mid = streakOpacity((1 + STREAK_SPEED_THRESHOLD) / 2, 1)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(STREAK_MAX_OPACITY)
  })

  it('scales with the Screen-shake setting and clamps bad inputs', () => {
    expect(streakOpacity(1, 0)).toBe(0)
    expect(streakOpacity(1, 0.5)).toBeCloseTo(STREAK_MAX_OPACITY / 2, 9)
    expect(streakOpacity(5, 3)).toBeCloseTo(STREAK_MAX_OPACITY, 9)
    expect(streakOpacity(Number.NaN, 1)).toBe(0)
    expect(streakOpacity(1, Number.NaN)).toBe(0)
  })
})

describe('streakRate', () => {
  it('runs faster with speed, clamped to 1–2', () => {
    expect(streakRate(0)).toBe(1)
    expect(streakRate(1)).toBe(2)
    expect(streakRate(9)).toBe(2)
    expect(streakRate(Number.NaN)).toBe(1)
  })
})

describe('streakLayout', () => {
  it('is deterministic and spreads streaks all around the screen', () => {
    const a = streakLayout()
    expect(a).toEqual(streakLayout())
    expect(a.length).toBe(STREAK_COUNT * 4)
    const angles = Array.from({ length: STREAK_COUNT }, (_, i) => a[i * 4]).sort((x, y) => x - y)
    let maxGap = angles[0] + Math.PI * 2 - angles[STREAK_COUNT - 1]
    for (let i = 1; i < STREAK_COUNT; i++) maxGap = Math.max(maxGap, angles[i] - angles[i - 1])
    expect(maxGap).toBeLessThan(((Math.PI * 2) / STREAK_COUNT) * 1.8)
    for (let i = 0; i < STREAK_COUNT; i++) {
      expect(a[i * 4 + 1]).toBeGreaterThanOrEqual(0)
      expect(a[i * 4 + 1]).toBeLessThan(1)
      expect(a[i * 4 + 2]).toBeGreaterThan(0)
      expect(a[i * 4 + 2]).toBeLessThan(1)
      expect(a[i * 4 + 3]).toBeGreaterThan(0)
    }
  })
})
