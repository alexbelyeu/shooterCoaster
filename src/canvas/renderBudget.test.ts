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
import { QUALITY_PROFILES } from './graphicsQuality'

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
    expect(composerMultisampling(true, QUALITY_PROFILES.high)).toBeLessThanOrEqual(4)
    expect(composerMultisampling(false, QUALITY_PROFILES.high)).toBe(8)
  })
})

describe('quality dpr cap', () => {
  it('caps a dense screen at the quality\'s maxDpr', () => {
    expect(budgetDpr(3, 390, 844, PIXEL_BUDGET_COARSE, QUALITY_PROFILES.medium.maxDpr)).toBe(1.5)
    expect(budgetDpr(3, 390, 844, PIXEL_BUDGET_COARSE, QUALITY_PROFILES.low.maxDpr)).toBe(1)
  })

  it('never lifts the dpr past MAX_DPR or the device', () => {
    expect(budgetDpr(3, 390, 844, PIXEL_BUDGET_COARSE, 4)).toBe(MAX_DPR)
    expect(budgetDpr(1, 390, 844, PIXEL_BUDGET_COARSE, 1.5)).toBe(1)
  })

  it('low quality turns MSAA off', () => {
    expect(composerMultisampling(false, QUALITY_PROFILES.low)).toBe(0)
    expect(composerMultisampling(true, QUALITY_PROFILES.low)).toBe(0)
  })
})
