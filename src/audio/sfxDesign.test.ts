import { describe, it, expect } from 'vitest'
import { createRng, hashString } from '@/utils/rng'
import {
  BIOME_REVERB, roomImpulse, roomLength,
  CHAIN, FIREWORK_BIOMES, FIREWORK_SFX, RUMBLE, fireworkWhistleS, nextClankAt, rumbleGain, rumbleHz, WIND, windGain, windHz, windUpdateDue,
} from './sfxDesign'

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


describe('ride sounds (#697)', () => {
  it('the wind has range: a breath at the crawl, a roar at the top', () => {
    expect(windGain(0.2)).toBeLessThan(WIND.maxGain / 10)
    expect(windGain(1) / windGain(0.5)).toBeGreaterThan(2.5)
  })

  it('the rumble sits under the ride from the crawl, opens with speed, and stops at 0', () => {
    expect(rumbleGain(0)).toBe(0)
    expect(rumbleGain(0.2)).toBeGreaterThan(RUMBLE.floorGain)
    expect(rumbleGain(1)).toBeCloseTo(RUMBLE.maxGain)
    expect(rumbleHz(1)).toBeGreaterThan(rumbleHz(0.2))
    expect(rumbleHz(1)).toBeLessThan(300)
  })

  it('clanks a chain dog every period of game time, slower in slow-mo, catching up after a stall', () => {
    expect(nextClankAt(-Infinity, 5, 1)).toBe(5)
    expect(nextClankAt(5, 5, 1)).toBeCloseTo(5 + CHAIN.periodS)
    expect(nextClankAt(5, 5, 0.5)).toBeCloseTo(5 + 2 * CHAIN.periodS)
    expect(nextClankAt(1, 5, 1)).toBe(5)
  })
})

describe('biome rooms (#802)', () => {
  const SR = 8000
  const biomes = Object.keys(BIOME_REVERB) as (keyof typeof BIOME_REVERB)[]
  const energy = (y: Float32Array, fromMs: number, toMs: number) => {
    let e = 0
    for (let i = Math.floor((SR * fromMs) / 1000); i < Math.min(y.length, Math.floor((SR * toMs) / 1000)); i++) e += y[i] * y[i]
    return e
  }

  it('gives every biome a pre-delay, early reflections and maybe a slap, in sane ranges', () => {
    const shapes = new Set<string>()
    for (const biome of biomes) {
      const r = BIOME_REVERB[biome]
      expect(r.preDelayMs, biome).toBeGreaterThanOrEqual(5)
      expect(r.preDelayMs, biome).toBeLessThanOrEqual(100)
      expect(r.early, biome).toBeGreaterThan(0)
      expect(r.early, biome).toBeLessThanOrEqual(0.5)
      if (r.slap) {
        expect(r.slap.ms, biome).toBeGreaterThan(r.preDelayMs + 50)
        expect(r.slap.ms, biome).toBeLessThan(250)
        expect(r.slap.share, biome).toBeGreaterThan(0)
        expect(r.slap.share, biome).toBeLessThanOrEqual(1)
      }
      shapes.add(JSON.stringify([r.preDelayMs, r.early, r.slap]))
    }
    expect(shapes.size).toBe(biomes.length)
    expect(BIOME_REVERB.desert.slap!.ms).toBeGreaterThanOrEqual(90)
    expect(BIOME_REVERB.desert.slap!.ms).toBeLessThanOrEqual(130)
    expect(Math.max(...biomes.map((b) => BIOME_REVERB[b].preDelayMs))).toBe(BIOME_REVERB.volcanic.preDelayMs)
    expect(Math.min(...biomes.map((b) => BIOME_REVERB[b].early))).toBe(BIOME_REVERB.ocean.early)
    expect(Math.max(...biomes.map((b) => BIOME_REVERB[b].early))).toBe(BIOME_REVERB.gym.early)
  })

  it('builds each room: silence, early taps, the tail from the pre-delay, the slap at its share', () => {
    for (const biome of biomes) {
      const r = BIOME_REVERB[biome]
      const [left, right] = roomImpulse(r, SR, createRng(hashString(biome)))
      expect(left.length, biome).toBe(roomLength(r, SR))
      expect(right.length, biome).toBe(left.length)
      expect(left.every(Number.isFinite), biome).toBe(true)
      expect(energy(left, 0, 3), biome).toBe(0)
      const tail = energy(left, r.preDelayMs, r.preDelayMs + r.seconds * 1000)
      const early = energy(left, 0, r.preDelayMs)
      // The taps land inside the gap (the last one may share its sample with the tail's first).
      expect(early / tail, biome).toBeGreaterThan(r.early * 0.5)
      expect(early / tail, biome).toBeLessThan(r.early * 1.5)
      if (r.slap) {
        const around = energy(left, r.slap.ms - 1, r.slap.ms + 1)
        expect(around / (tail - around), biome).toBeGreaterThan(r.slap.share * 0.9)
      }
    }
  })

  it('is the same room for the same seed', () => {
    const r = BIOME_REVERB.desert
    expect(roomImpulse(r, SR, createRng(1))[1]).toEqual(roomImpulse(r, SR, createRng(1))[1])
  })
})
