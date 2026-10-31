import { describe, expect, it } from 'vitest'
import { boostStrength, particleCounts, PARTICLE_PRESETS } from './particlePresets'

const presets = Object.entries(PARTICLE_PRESETS)

describe('particle presets', () => {
  it('has the five biome presets', () => {
    expect(Object.keys(PARTICLE_PRESETS).sort()).toEqual(['arcticSnow', 'desertDust', 'oceanPlankton', 'parkPollen', 'volcanicAsh'])
  })

  it.each(presets)('%s stays subtle: count, box and share within bounds', (_, p) => {
    expect(p.count).toBeGreaterThanOrEqual(500)
    expect(p.count + (p.boost?.count ?? 0)).toBeLessThanOrEqual(4000)
    for (const side of p.box) {
      expect(side).toBeGreaterThanOrEqual(150)
      expect(side).toBeLessThanOrEqual(600)
    }
    expect(p.secondaryShare).toBeGreaterThan(0)
    expect(p.secondaryShare).toBeLessThanOrEqual(0.5)
  })

  it.each(presets)('%s layers: sizes, pixels, alpha and drift within bounds', (_, p) => {
    for (const layer of [p.primary, p.secondary]) {
      expect(layer.size).toBeGreaterThan(0)
      expect(layer.size).toBeLessThanOrEqual(2)
      expect(layer.maxPixels).toBeGreaterThanOrEqual(1)
      expect(layer.maxPixels).toBeLessThanOrEqual(5)
      expect(layer.opacity).toBeGreaterThan(0)
      expect(layer.opacity).toBeLessThanOrEqual(0.9)
      if (layer.additive) expect(layer.opacity * layer.maxPixels).toBeLessThanOrEqual(3.6)
      expect(Math.hypot(...layer.velocity)).toBeLessThanOrEqual(20)
      expect(layer.sway).toBeGreaterThanOrEqual(0)
      expect(layer.sway).toBeLessThanOrEqual(12)
      expect(layer.flicker).toBeGreaterThanOrEqual(0)
      expect(layer.flicker).toBeLessThanOrEqual(1)
      expect(Number.isInteger(layer.color) && layer.color >= 0 && layer.color <= 0xffffff).toBe(true)
    }
  })

  it('snow falls, plankton rises, dust drifts sideways', () => {
    expect(PARTICLE_PRESETS.arcticSnow.primary.velocity[1]).toBeLessThan(0)
    expect(PARTICLE_PRESETS.oceanPlankton.primary.velocity[1]).toBeGreaterThan(0)
    expect(PARTICLE_PRESETS.oceanPlankton.primary.additive).toBe(true)
    const [dx, dy, dz] = PARTICLE_PRESETS.desertDust.primary.velocity
    expect(Math.hypot(dx, dz)).toBeGreaterThan(4 * Math.abs(dy))
  })

  it('only the volcano erupts', () => {
    for (const [name, p] of presets) {
      expect(p.boost === undefined, name).toBe(name !== 'volcanicAsh')
    }
    const boost = PARTICLE_PRESETS.volcanicAsh.boost!
    expect(boost.event).toBe('eruption:start')
    expect(boost.count).toBeGreaterThan(0)
  })
})

describe('particleCounts', () => {
  it('draws the preset counts on desktop and half on touch', () => {
    const p = PARTICLE_PRESETS.volcanicAsh
    expect(particleCounts(p, false)).toEqual({ base: 3000, boost: 600 })
    expect(particleCounts(p, true)).toEqual({ base: 1500, boost: 300 })
    expect(particleCounts(PARTICLE_PRESETS.arcticSnow, false).boost).toBe(0)
  })

  it('scales both counts by the graphics quality', () => {
    const p = PARTICLE_PRESETS.volcanicAsh
    expect(particleCounts(p, false, 0.5)).toEqual({ base: 1500, boost: 300 })
    expect(particleCounts(p, true, 0.5)).toEqual({ base: 750, boost: 150 })
  })
})

describe('boostStrength', () => {
  const boost = { event: 'x', count: 1, riseS: 0.25, holdS: 3, fadeS: 1 }

  it('rises, holds at full, fades linearly to 0, and is 0 before the event', () => {
    expect(boostStrength(boost, -1)).toBe(0)
    expect(boostStrength(boost, 0)).toBe(0)
    expect(boostStrength(boost, 0.125)).toBeCloseTo(0.5)
    expect(boostStrength(boost, 0.25)).toBe(1)
    expect(boostStrength(boost, 3.25)).toBe(1)
    expect(boostStrength(boost, 3.75)).toBeCloseTo(0.5)
    expect(boostStrength(boost, 4.25)).toBe(0)
    expect(boostStrength(boost, 100)).toBe(0)
  })

  it('never steps by more than one frame of rise or fade (no pop at start or end)', () => {
    const maxStep = 1 / 60 / Math.min(boost.riseS, boost.fadeS) + 1e-9
    let prev = boostStrength(boost, -1 / 60)
    for (let t = 0; t < 6; t += 1 / 60) {
      const s = boostStrength(boost, t)
      expect(Math.abs(s - prev)).toBeLessThanOrEqual(maxStep)
      prev = s
    }
  })
})
