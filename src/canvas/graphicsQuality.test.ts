import { describe, expect, it } from 'vitest'
import { GRAPHICS_QUALITIES, isGraphicsQuality, QUALITY_PROFILES, qualityFromQuery, qualityProfile } from './graphicsQuality'

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
