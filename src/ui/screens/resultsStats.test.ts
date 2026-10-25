import { describe, expect, it } from 'vitest'
import { accuracyPercent, barFill, formatAccuracy, formatTimeLeft, isNewRecord, nextStar } from './resultsStats'

describe('accuracy', () => {
  it('is hits / shots as a whole percent', () => {
    expect(accuracyPercent(1, 3)).toBe(33)
    expect(accuracyPercent(2, 3)).toBe(67)
    expect(formatAccuracy(5, 10)).toBe('50%')
  })

  it('never NaN: no shots reads as a dash', () => {
    expect(accuracyPercent(0, 0)).toBeNull()
    expect(formatAccuracy(0, 0)).toBe('—')
    expect(formatAccuracy(3, 0)).toBe('—')
  })

  it('caps at 100% (one shot can resolve several hits in the e2e hook)', () => {
    expect(formatAccuracy(5, 1)).toBe('100%')
  })
})

describe('formatTimeLeft', () => {
  it('rounds up and never goes negative', () => {
    expect(formatTimeLeft(12.2)).toBe('13s')
    expect(formatTimeLeft(0.1)).toBe('1s')
    expect(formatTimeLeft(0)).toBe('0s')
    expect(formatTimeLeft(-0.4)).toBe('0s')
  })
})

describe('isNewRecord', () => {
  it('needs a non-zero score above the previous best', () => {
    expect(isNewRecord(100, 0)).toBe(true)
    expect(isNewRecord(100, 99)).toBe(true)
    expect(isNewRecord(100, 100)).toBe(false)
    expect(isNewRecord(0, 0)).toBe(false)
  })
})

describe('nextStar', () => {
  const t = [0.3, 0.6, 0.9] as const
  it('names the next star and the points to it', () => {
    expect(nextStar(0, 1000, t)).toEqual({ stars: 1, points: 300 })
    expect(nextStar(299.5, 1000, t)).toEqual({ stars: 1, points: 1 })
    expect(nextStar(300, 1000, t)).toEqual({ stars: 2, points: 300 })
    expect(nextStar(899, 1000, t)).toEqual({ stars: 3, points: 1 })
  })

  it('is null with all stars or no max score', () => {
    expect(nextStar(900, 1000, t)).toBeNull()
    expect(nextStar(10, 0, t)).toBeNull()
  })
})

describe('barFill', () => {
  it('clamps to 0-1', () => {
    expect(barFill(500, 1000)).toBe(0.5)
    expect(barFill(2000, 1000)).toBe(1)
    expect(barFill(10, 0)).toBe(0)
  })
})
