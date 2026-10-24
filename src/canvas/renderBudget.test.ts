import { describe, expect, it } from 'vitest'
import {
  budgetDpr,
  composerMultisampling,
  MAX_DPR,
  MIN_DPR,
  PIXEL_BUDGET_COARSE,
  PIXEL_BUDGET_FINE,
  pixelBudget,
} from './renderBudget'

describe('budgetDpr', () => {
  it('keeps the device dpr when the screen fits the budget', () => {
    expect(budgetDpr(1, 1920, 1080, PIXEL_BUDGET_FINE)).toBe(1)
    expect(budgetDpr(2, 1280, 800, PIXEL_BUDGET_FINE)).toBe(2)
  })

  it('caps at MAX_DPR', () => {
    expect(budgetDpr(3, 390, 844, PIXEL_BUDGET_COARSE)).toBe(MAX_DPR)
  })

  it('scales down to fit the pixel budget', () => {
    const dpr = budgetDpr(2, 1920, 1080, PIXEL_BUDGET_FINE)
    expect(dpr).toBeCloseTo(Math.sqrt(PIXEL_BUDGET_FINE / (1920 * 1080)), 6)
    expect(1920 * 1080 * dpr * dpr).toBeCloseTo(PIXEL_BUDGET_FINE, 0)
  })

  it('gives tablets the coarse budget', () => {
    const dpr = budgetDpr(2, 1024, 1366, PIXEL_BUDGET_COARSE)
    expect(1024 * 1366 * dpr * dpr).toBeCloseTo(PIXEL_BUDGET_COARSE, 0)
  })

  it('never goes below MIN_DPR, even on huge screens', () => {
    expect(budgetDpr(1, 3840, 2160, PIXEL_BUDGET_FINE)).toBe(MIN_DPR)
    expect(budgetDpr(2, 7680, 4320, PIXEL_BUDGET_COARSE)).toBe(MIN_DPR)
  })

  it('survives a zero-size canvas and a bogus device dpr', () => {
    expect(budgetDpr(2, 0, 0, PIXEL_BUDGET_FINE)).toBe(2)
    expect(budgetDpr(Number.NaN, 800, 600, PIXEL_BUDGET_FINE)).toBe(1)
    expect(budgetDpr(0, 800, 600, PIXEL_BUDGET_FINE)).toBe(1)
  })
})

describe('budget by pointer', () => {
  it('touch gets the smaller budget and less MSAA', () => {
    expect(pixelBudget(true)).toBeLessThan(pixelBudget(false))
    expect(composerMultisampling(true)).toBeLessThanOrEqual(4)
    expect(composerMultisampling(false)).toBe(8)
  })
})
