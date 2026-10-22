import { describe, expect, it } from 'vitest'
import { createLavaGlowSampler, GLOW_RADIUS } from './lavaGlow'
import { RIVER_CONFIGS, RIVER_SEGMENTS, riverRow } from './lavaRiverPaths'

describe('lava glow', () => {
  const sample = createLavaGlowSampler()

  it('is full on every river centre line', () => {
    for (const cfg of RIVER_CONFIGS) {
      for (const i of [0, RIVER_SEGMENTS / 2, RIVER_SEGMENTS]) {
        const { cx, cz } = riverRow(cfg, i)
        expect(sample(cx, cz)).toBeCloseTo(1, 5)
      }
    }
  })

  it('falls off with distance from the river and is zero past the radius', () => {
    const cfg = RIVER_CONFIGS[0]
    const { cx, cz, px, pz } = riverRow(cfg, RIVER_SEGMENTS / 2)
    const at = (d: number) => sample(cx + px * (cfg.halfWidth + d), cz + pz * (cfg.halfWidth + d))
    expect(at(GLOW_RADIUS * 0.25)).toBeGreaterThan(at(GLOW_RADIUS * 0.5))
    expect(at(GLOW_RADIUS * 0.5)).toBeGreaterThan(at(GLOW_RADIUS * 0.75))
    expect(at(GLOW_RADIUS + 1)).toBe(0)
  })

  it('leaves the track centre (origin) untouched', () => {
    expect(sample(0, 0)).toBe(0)
  })
})
