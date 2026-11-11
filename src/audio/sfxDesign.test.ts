import { describe, it, expect } from 'vitest'
import { FIREWORK_BIOMES, FIREWORK_SFX, fireworkWhistleS, WIND, windGain, windHz, windUpdateDue } from './sfxDesign'

describe('wind', () => {
  it('opens and brightens with speed', () => {
    expect(windGain(0)).toBe(0)
    expect(windGain(1)).toBeCloseTo(WIND.maxGain)
    expect(windHz(1)).toBeGreaterThan(windHz(0))
  })

  it('re-aims at most every minIntervalS and only past minStep, but always reaches silence', () => {
    const last = { speed: 0, at: -Infinity }
    expect(windUpdateDue(0, 0, last)).toBe(false)
    expect(windUpdateDue(0.5, 0, last)).toBe(true)
    expect(windUpdateDue(0.9, 0.05, last)).toBe(false)
    expect(windUpdateDue(0.5 + WIND.minStep / 2, 0.2, last)).toBe(false)
    expect(windUpdateDue(0.6, 0.2, last)).toBe(true)
    expect(last).toEqual({ speed: 0.6, at: 0.2 })
    expect(windUpdateDue(0.01, 0.4, last)).toBe(true)
    expect(windUpdateDue(0, 0.6, last)).toBe(true)
    expect(windUpdateDue(0, 0.8, last)).toBe(false)
  })

  it('lets a stop through right after a re-aim (the unmount calls wind(0) once)', () => {
    const last = { speed: 0, at: -Infinity }
    expect(windUpdateDue(0.7, 1, last)).toBe(true)
    expect(windUpdateDue(0, last.at + 0.01, last)).toBe(true)
    expect(last).toEqual({ speed: 0, at: 1.01 })
  })
})

describe('firework cues', () => {
  it('only the theme park has them', () => {
    expect(FIREWORK_BIOMES).toEqual(['themePark'])
  })

  it('stretches the whistle with slow-mo, within bounds', () => {
    expect(fireworkWhistleS(1.1, 1)).toBeCloseTo(1.1)
    expect(fireworkWhistleS(1.1, 0.5)).toBeCloseTo(2.2)
    expect(fireworkWhistleS(1.1, 0)).toBe(FIREWORK_SFX.whistle.maxS)
    expect(fireworkWhistleS(0.1, 1)).toBe(FIREWORK_SFX.whistle.minS)
  })
})

