import { describe, expect, it } from 'vitest'
import { ATMOSPHERES, type AtmosphereConfig } from './atmosphere'
import { NIGHT_ATMOSPHERES, atmosphereFor, hasNightRide } from './nightPreset'
import type { BiomeType } from '@/types/level'

/** Relative luminance of an sRGB hex, near enough for "darker than". */
function luma(hex: number): number {
  return (0.2126 * ((hex >> 16) & 0xff) + 0.7152 * ((hex >> 8) & 0xff) + 0.0722 * (hex & 0xff)) / 255
}

const nights = Object.entries(NIGHT_ATMOSPHERES) as [BiomeType, AtmosphereConfig][]

describe('night presets', () => {
  it.each(['themePark', 'desert', 'ocean'] as const)('%s has one', (biome) => {
    expect(hasNightRide(biome)).toBe(true)
  })

  it.each(nights)('%s at night is darker than by day, its lamps lit and its lights still there', (biome, night) => {
    const day = ATMOSPHERES[biome]
    expect(luma(night.sky.zenith)).toBeLessThan(luma(day.sky.zenith) * 0.5)
    expect(luma(night.sky.horizon)).toBeLessThan(luma(day.sky.horizon) * 0.5)
    expect(night.sunLightIntensity).toBeLessThan(day.sunLightIntensity)
    expect(night.hemiIntensity).toBeLessThanOrEqual(day.hemiIntensity)
    // Enemies have to read against the dark: the moon and the fill never go out.
    expect(night.sunLightIntensity + night.hemiIntensity).toBeGreaterThan(1.2)
    expect(night.fogFar).toBeLessThanOrEqual(day.fogFar)
    expect(night.lampGlow).toBeGreaterThan(0)
    expect(day.lampGlow ?? 0).toBe(0)
    expect(night.enemyRimLift).toBeGreaterThan(1)
    expect(day.enemyRimLift ?? 1).toBe(1)
    expect(night.heatShimmer).toBe(day.heatShimmer)
  })
})

describe('atmosphereFor', () => {
  it('is the biome atmosphere by day and on a biome with no night preset', () => {
    expect(atmosphereFor('themePark', 'day')).toBe(ATMOSPHERES.themePark)
    const without = (Object.keys(ATMOSPHERES) as BiomeType[]).find((b) => !hasNightRide(b))
    expect(without).toBeDefined()
    expect(atmosphereFor(without!, 'night')).toBe(ATMOSPHERES[without!])
  })

  it('is the night preset on a Night Ride', () => {
    expect(atmosphereFor('themePark', 'night')).toBe(NIGHT_ATMOSPHERES.themePark)
  })
})
