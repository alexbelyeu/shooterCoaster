import { describe, it, expect } from 'vitest'
import { FIRE_VARIANTS, STINGERS, STINGER_VOICES, fireVelocity, killLayers, killTier } from './sfxDesign'

describe('killTier / killLayers', () => {
  it('maps combo counts to the four tiers', () => {
    expect([0, 1, 2, 3, 5, 6, 9, 10, 40].map(killTier)).toEqual([0, 0, 0, 1, 1, 2, 2, 3, 3])
  })

  it('adds one layer per tier on top of the previous ones', () => {
    expect(killLayers(2)).toEqual({ thump: false, ring: false, swell: false })
    expect(killLayers(4)).toEqual({ thump: true, ring: false, swell: false })
    expect(killLayers(7)).toEqual({ thump: true, ring: true, swell: false })
    expect(killLayers(12)).toEqual({ thump: true, ring: true, swell: true })
  })
})

describe('fire sound', () => {
  it('has three downward-sweeping variants', () => {
    expect(FIRE_VARIANTS).toHaveLength(3)
    for (const v of FIRE_VARIANTS) expect(v.endHz).toBeLessThan(v.startHz)
  })

  it('plays auto-fire 6 dB quieter', () => {
    expect(20 * Math.log10(fireVelocity(true) / fireVelocity(false))).toBeCloseTo(-6, 0)
  })
})

describe('wave stingers', () => {
  const NOTE = /^[A-G](#|b)?-?\d$/

  it('fit the pre-created voices and use valid note names', () => {
    for (const d of Object.values(STINGERS)) {
      for (const chord of d.chords) {
        expect(chord.length).toBeLessThanOrEqual(STINGER_VOICES)
        for (const n of chord) expect(n).toMatch(NOTE)
      }
      for (const n of d.drum ?? []) expect(n).toMatch(NOTE)
      expect(d.drive).toBeGreaterThanOrEqual(0)
      expect(d.drive).toBeLessThanOrEqual(1)
    }
  })
})
