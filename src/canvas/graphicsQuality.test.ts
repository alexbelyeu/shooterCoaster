import { describe, expect, it } from 'vitest'
import { fbmOctaves, particleShare, GRAPHICS_QUALITIES, isGraphicsQuality, QUALITY_PROFILES, qualityFromQuery, qualityProfile } from './graphicsQuality'

describe('graphics quality presets', () => {
  it('auto renders like high', () => {
    expect(qualityProfile('auto')).toBe(QUALITY_PROFILES.high)
  })

  it('steps down in every cost from high to low', () => {
    const [high, medium, low] = [QUALITY_PROFILES.high, QUALITY_PROFILES.medium, QUALITY_PROFILES.low]
    for (const [a, b] of [[high, medium], [medium, low]]) {
      expect(b.maxDpr).toBeLessThan(a.maxDpr)
      expect(b.multisampling.fine).toBeLessThan(a.multisampling.fine)
      expect(b.multisampling.coarse).toBeLessThan(a.multisampling.coarse)
      expect(b.particleScale).toBeLessThan(a.particleScale)
    }
  })

  it('low is 1× dpr, no bloom, no contact shadows, half the particles', () => {
    expect(QUALITY_PROFILES.low).toMatchObject({ maxDpr: 1, bloom: false, contactShadows: false, particleScale: 0.5 })
    expect(QUALITY_PROFILES.high).toMatchObject({ maxDpr: 2, bloom: true, contactShadows: true, particleScale: 1 })
  })

  it('has one rule for the noise shaders\' octaves: the quality\'s, at most 3 on touch', () => {
    expect(fbmOctaves(QUALITY_PROFILES.high, false)).toBe(4)
    expect(fbmOctaves(QUALITY_PROFILES.medium, false)).toBe(4)
    expect(fbmOctaves(QUALITY_PROFILES.low, false)).toBe(3)
    for (const profile of Object.values(QUALITY_PROFILES)) expect(fbmOctaves(profile, true)).toBe(3)
  })
})

describe('qualityFromQuery', () => {
  it('reads ?quality= presets', () => {
    for (const q of GRAPHICS_QUALITIES) expect(qualityFromQuery(`?e2e=1&quality=${q}`)).toBe(q)
  })

  it('ignores a missing or unknown value', () => {
    expect(qualityFromQuery('?e2e=1')).toBeNull()
    expect(qualityFromQuery('?quality=ultra')).toBeNull()
    expect(isGraphicsQuality(undefined)).toBe(false)
  })
})

describe('particleShare', () => {
  it('is the quality scale, halved on touch', () => {
    expect(particleShare(false, 1)).toBe(1)
    expect(particleShare(true, 1)).toBe(0.5)
    expect(particleShare(true, 0.5)).toBe(0.25)
  })
})
