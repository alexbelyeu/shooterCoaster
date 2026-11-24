import { describe, expect, it } from 'vitest'
import {
  BIOME_TERRAIN_CONFIGS,
  TRACK_CLEARANCE,
  createHeightFunction,
  type NoiseTerrainConfig,
  getTerrainSlope,
  sampleTrackPath,
  sightClear,
} from './terrainNoise'
import { shippedLevels } from '@/levels/shippedLevels'
import { BIOMES, biomeHeightFunction } from '@/levels/environments/biomeRegistry'
import { GYM_SCALE } from '@/levels/environments/biomes/gym/blockout'
import { createTrackCurve } from '@/track/curves/createTrackCurve'
import { BIOME_TYPES, type BiomeType, type RiddenLevel } from '@/types/level'

// The noise-terrain biomes (an interior's ground is its authored floor: `biomeHeightFunction`).
const NOISE_BIOMES = BIOME_TYPES.filter((b) => !BIOMES[b].floor)
const levels = shippedLevels()

function noiseConfig(biome: BiomeType): NoiseTerrainConfig {
  const c = BIOME_TERRAIN_CONFIGS[biome]
  if ('authoredFloor' in c) throw new Error(`${biome} has an authored floor`)
  return c
}

function trackSamplesFor(level: RiddenLevel) {
  const c = createTrackCurve(level.track)
  return { curve: c, samples: sampleTrackPath((t) => c.getPointAt(t)) }
}

describe('sightClear', () => {
  // A ridge 100 high across x = 500..600, flat ground elsewhere.
  const ridge = (x: number) => (x >= 500 && x <= 600 ? 100 : 0)

  it('is blocked by ground over the line, not by ground under it', () => {
    expect(sightClear(ridge, 0, 50, 0, 1000, 50, 0)).toBe(false)
    expect(sightClear(ridge, 0, 150, 0, 1000, 150, 0)).toBe(true)
  })

  it('sees over a ridge from high enough on one end', () => {
    expect(sightClear(ridge, 0, 50, 0, 1000, 400, 0)).toBe(true)
    expect(sightClear(ridge, 0, 0, 0, 1000, 50, 0)).toBe(false)
  })
})

describe('BIOME_TERRAIN_CONFIGS', () => {
  it('has a config for every biome', () => {
    for (const biome of BIOME_TYPES) {
      expect(BIOME_TERRAIN_CONFIGS[biome], biome).toBeDefined()
    }
  })

  it('marks exactly the biomes with an authored floor as authoredFloor', () => {
    for (const biome of BIOME_TYPES) {
      expect('authoredFloor' in BIOME_TERRAIN_CONFIGS[biome], biome).toBe(!!BIOMES[biome].floor)
    }
  })

  it('has sane noise values for every noise-terrain biome a level uses', () => {
    for (const level of levels.filter((l) => NOISE_BIOMES.includes(l.biome))) {
      const c = noiseConfig(level.biome)
      expect(c.octaves).toBeGreaterThanOrEqual(1)
      expect(c.amplitude).toBeGreaterThan(0)
      expect(c.persistence).toBeGreaterThan(0)
      expect(c.persistence).toBeLessThan(1)
      expect(c.flatRadius).toBeGreaterThan(0)
      expect(c.transitionWidth).toBeGreaterThan(0)
      expect(c.meshSize).toBeGreaterThan(0)
    }
  })
})

describe('createHeightFunction', () => {
  it('is deterministic: same input gives the same output, across instances', () => {
    for (const biome of NOISE_BIOMES) {
      const a = createHeightFunction(biome)
      const b = createHeightFunction(biome)
      for (const [x, z] of [[0, 0], [1234.5, -987.25], [-3000, 2500], [4100, 4100]]) {
        expect(a(x, z)).toBe(a(x, z))
        expect(b(x, z)).toBe(a(x, z))
      }
    }
  })

  it('returns finite heights and keeps the centre flat at baseY', () => {
    for (const biome of NOISE_BIOMES) {
      const h = createHeightFunction(biome)
      const { baseY, flatRadius } = noiseConfig(biome)
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
    for (const biome of NOISE_BIOMES) {
      const h = createHeightFunction(biome)
      const { baseY } = noiseConfig(biome)
      let maxRise = 0
      for (let a = 0; a < Math.PI * 2; a += 0.1) {
        maxRise = Math.max(maxRise, h(Math.cos(a) * 3000, Math.sin(a) * 3000) - baseY)
      }
      expect(maxRise, biome).toBeGreaterThan(10)
    }
  })

  describe.each(levels.map((l) => [l.id, l] as const))('track corridor for %s', (_id, level) => {
    const { curve, samples } = trackSamplesFor(level)
    const h = biomeHeightFunction(level.biome, samples)

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

describe('biomeHeightFunction', () => {
  it("gives an interior its authored floor (the gym's Starr pit), never the noise", () => {
    expect(() => createHeightFunction('gym')).toThrow(/authored floor/)
    const h = biomeHeightFunction('gym')
    let lowest = Infinity
    let highest = -Infinity
    for (let x = -1280; x <= 1280; x += 20) {
      for (let z = -1280; z <= 1280; z += 20) {
        lowest = Math.min(lowest, h(x, z))
        highest = Math.max(highest, h(x, z))
      }
    }
    expect(highest).toBe(0)
    expect(lowest).toBeCloseTo(-2.45 * GYM_SCALE)
  })
})

describe('getTerrainSlope', () => {
  it('is zero on flat ground and steep on a known slope', () => {
    expect(getTerrainSlope(() => 0, 10, 10)).toBe(0)
    expect(getTerrainSlope((x) => x, 0, 0)).toBeCloseTo(Math.PI / 4, 9)
  })
})
