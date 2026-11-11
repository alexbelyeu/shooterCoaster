import { describe, expect, it } from 'vitest'
import {
  COMBO_TIERS, FRENZY, LAST_KILL, comboExpired, comboMultiplier, comboTierIndex, comboWindowS, frenzyStage, frenzyTimeScale, slowMoScale,
} from './comboTiers'

describe('combo tiers', () => {
  it('maps kill counts to 1× (1–3), 2× (4–7), 3× (8–14), 5× (15+)', () => {
    const counts = [0, 1, 3, 4, 7, 8, 14, 15, 99]
    expect(counts.map(comboTierIndex)).toEqual([0, 0, 0, 1, 1, 2, 2, 3, 3])
    expect(counts.map(comboMultiplier)).toEqual([1, 1, 1, 2, 2, 3, 3, 5, 5])
  })

  it('shrinks the window from 2.0 s at 1× to 1.4 s at 5×', () => {
    expect([1, 4, 8, 15].map(comboWindowS)).toEqual([2.0, 1.8, 1.6, 1.4])
  })

  it('table is ordered: counts and multipliers rise, windows shrink', () => {
    for (let i = 1; i < COMBO_TIERS.length; i++) {
      expect(COMBO_TIERS[i].minCount).toBeGreaterThan(COMBO_TIERS[i - 1].minCount)
      expect(COMBO_TIERS[i].multiplier).toBeGreaterThan(COMBO_TIERS[i - 1].multiplier)
      expect(COMBO_TIERS[i].windowS).toBeLessThan(COMBO_TIERS[i - 1].windowS)
    }
  })

  it("expires once the tier's window has passed, never with no chain", () => {
    expect(comboExpired(3, 10, 11.99)).toBe(false)
    expect(comboExpired(3, 10, 12)).toBe(true)
    expect(comboExpired(15, 10, 11.39)).toBe(false)
    expect(comboExpired(15, 10, 11.4)).toBe(true)
    expect(comboExpired(0, 0, 1000)).toBe(false)
  })
})

describe('frenzyTimeScale', () => {
  it('is 1 outside the frenzy', () => {
    expect(frenzyTimeScale(0)).toBe(1)
    expect(frenzyTimeScale(-1)).toBe(1)
    expect(frenzyTimeScale(FRENZY.durationS)).toBe(1)
    expect(frenzyTimeScale(Number.NaN)).toBe(1)
  })

  it('eases down to the slow-mo scale, holds it, and eases back', () => {
    const mid = frenzyTimeScale(FRENZY.easeS / 2)
    expect(mid).toBeLessThan(1)
    expect(mid).toBeGreaterThan(FRENZY.timeScale)
    expect(frenzyTimeScale(FRENZY.easeS)).toBeCloseTo(FRENZY.timeScale)
    expect(frenzyTimeScale(FRENZY.durationS / 2)).toBeCloseTo(FRENZY.timeScale)
    expect(frenzyTimeScale(FRENZY.durationS - FRENZY.easeS)).toBeCloseTo(FRENZY.timeScale)
    expect(frenzyTimeScale(FRENZY.durationS - 0.01)).toBeGreaterThan(0.95)
  })
})

describe('frenzyStage', () => {
  it('is on through the hold, out over the ease back, off outside the envelope', () => {
    expect(frenzyStage(Infinity)).toBe('off')
    expect(frenzyStage(Number.NaN)).toBe('off')
    expect(frenzyStage(-1)).toBe('off')
    expect(frenzyStage(0)).toBe('on')
    expect(frenzyStage(FRENZY.durationS - FRENZY.easeS)).toBe('on')
    expect(frenzyStage(FRENZY.durationS - FRENZY.easeS / 2)).toBe('out')
    expect(frenzyStage(FRENZY.durationS)).toBe('off')
  })
})

describe('slowMoScale', () => {
  const mid = FRENZY.durationS / 2
  it('is 1 with nothing running', () => {
    expect(slowMoScale(null, Infinity, Infinity)).toBe(1)
  })
  it('follows a lone frenzy or last kill', () => {
    expect(slowMoScale(null, mid, Infinity)).toBeCloseTo(FRENZY.timeScale)
    expect(slowMoScale(null, Infinity, 0)).toBe(LAST_KILL.timeScale)
    expect(slowMoScale(null, Infinity, LAST_KILL.durationS)).toBe(1)
  })
  it('the slowest envelope wins, an override beats both', () => {
    expect(slowMoScale(null, mid, 0.5)).toBe(LAST_KILL.timeScale)
    expect(slowMoScale(0, mid, 0.5)).toBe(0)
    expect(slowMoScale(4, mid, 0.5)).toBe(4)
  })
})
