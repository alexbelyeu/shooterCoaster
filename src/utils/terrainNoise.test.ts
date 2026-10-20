import { describe, expect, it } from 'vitest'
import {
  BIOME_TERRAIN_CONFIGS,
  TRACK_CLEARANCE,
  createHeightFunction,
  getTerrainSlope,
  sampleTrackPath,
} from './terrainNoise'
import { getAllLevels } from '@/levels/LevelRegistry'
import { createTrigCurve } from '@/track/curves/TrigCurve'
import { createTrigCurve2 } from '@/track/curves/TrigCurve2'
import type { BiomeType, LevelConfig } from '@/types/level'

const ALL_BIOMES: BiomeType[] = ['themePark', 'desert', 'ocean', 'arctic', 'volcanic']
const levels = getAllLevels()

function trackSamplesFor(level: LevelConfig) {
  const { curve, varA, varB, varC, scalar } = level.track
  const factory = curve === 'curve2' ? createTrigCurve2 : createTrigCurve
  const c = factory(varA, varB, varC, scalar)
  return { curve: c, samples: sampleTrackPath((t) => c.getPointAt(t)) }
}

describe('BIOME_TERRAIN_CONFIGS', () => {
  it('has a config for every biome', () => {
    for (const biome of ALL_BIOMES) {
      expect(BIOME_TERRAIN_CONFIGS[biome], biome).toBeDefined()
    }
  })

  it('has a config for every biome a level uses, with sane values', () => {
    for (const level of levels) {
      const c = BIOME_TERRAIN_CONFIGS[level.biome]
      expect(c, level.id).toBeDefined()
      expect(c.octaves).toBeGreaterThanOrEqual(1)
      expect(c.amplitude).toBeGreaterThan(0)
      expect(c.persistence).toBeGreaterThan(0)
      expect(c.persistence).toBeLessThan(1)
      expect(c.flatRadius).toBeGreaterThan(0)
      expect(c.transitionWidth).toBeGreaterThan(0)
    }
  })
})

describe('createHeightFunction', () => {
  it('is deterministic: same input gives the same output, across instances', () => {
    for (const biome of ALL_BIOMES) {
      const a = createHeightFunction(biome)
      const b = createHeightFunction(biome)
      for (const [x, z] of [[0, 0], [1234.5, -987.25], [-3000, 2500], [4100, 4100]]) {
        expect(a(x, z)).toBe(a(x, z))
        expect(b(x, z)).toBe(a(x, z))
      }
    }
  })

  it('returns finite heights and keeps the centre flat at baseY', () => {
    for (const biome of ALL_BIOMES) {
      const h = createHeightFunction(biome)
      const { baseY, flatRadius } = BIOME_TERRAIN_CONFIGS[biome]
      expect(h(0, 0)).toBe(baseY)
      expect(h(flatRadius * 0.7, -flatRadius * 0.7)).toBe(baseY)
      for (let i = 0; i < 200; i++) {
        const x = Math.sin(i * 12.9898) * 5000
        const z = Math.cos(i * 78.233) * 5000
        expect(Number.isFinite(h(x, z))).toBe(true)
      }
    }
  })

  it('produces actual relief outside the flat valley', () => {
    for (const biome of ALL_BIOMES) {
      const h = createHeightFunction(biome)
      const { baseY } = BIOME_TERRAIN_CONFIGS[biome]
      let maxRise = 0
      for (let a = 0; a < Math.PI * 2; a += 0.1) {
        maxRise = Math.max(maxRise, h(Math.cos(a) * 3000, Math.sin(a) * 3000) - baseY)
      }
      expect(maxRise, biome).toBeGreaterThan(10)
    }
  })

  describe.each(levels.map((l) => [l.id, l] as const))('track corridor for %s', (_id, level) => {
    const { curve, samples } = trackSamplesFor(level)
    const h = createHeightFunction(level.biome, samples)

    it(`keeps terrain at least TRACK_CLEARANCE (${TRACK_CLEARANCE}) below every track sample`, () => {
      for (const s of samples) {
        expect(h(s.x, s.z)).toBeLessThanOrEqual(s.y - TRACK_CLEARANCE + 1e-9)
      }
    })

    it('keeps terrain below the track between samples too', () => {
      // Points the coaster actually rides through that were not in the lookup table.
      const n = samples.length
      for (let i = 0; i < n; i++) {
        const p = curve.getPointAt((i + 0.5) / n)
        expect(h(p.x, p.z)).toBeLessThan(p.y)
      }
    })
  })
})

describe('getTerrainSlope', () => {
  it('is zero on flat ground and steep on a known slope', () => {
    expect(getTerrainSlope(() => 0, 10, 10)).toBe(0)
    expect(getTerrainSlope((x) => x, 0, 0)).toBeCloseTo(Math.PI / 4, 9)
  })
})
