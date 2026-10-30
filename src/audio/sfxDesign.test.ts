import { describe, it, expect } from 'vitest'
import { BOSS_SFX, FIREWORK_BIOMES, FIREWORK_SFX, FIRE_VARIANTS, STINGERS, STINGER_VOICES, bossHitHz, fireVelocity, fireworkWhistleS, KILL_TIMBRES, killLayers, killPingHz, killTier } from './sfxDesign'

describe('killTier / killLayers', () => {
  it('maps combo counts to the four tiers', () => {
    expect([0, 1, 3, 4, 7, 8, 14, 15, 40].map(killTier)).toEqual([0, 0, 0, 1, 1, 2, 2, 3, 3])
  })

  it('adds one layer per tier on top of the previous ones', () => {
    expect(killLayers(3)).toEqual({ thump: false, ring: false, swell: false })
    expect(killLayers(4)).toEqual({ thump: true, ring: false, swell: false })
    expect(killLayers(9)).toEqual({ thump: true, ring: true, swell: false })
    expect(killLayers(15)).toEqual({ thump: true, ring: true, swell: true })
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

describe('boss cues', () => {
  it('arrival fits the stinger voices, one drum note per chord', () => {
    for (const chord of BOSS_SFX.arrival.chords) expect(chord.length).toBeLessThanOrEqual(STINGER_VOICES)
    expect(BOSS_SFX.defeat.chord.length).toBeLessThanOrEqual(STINGER_VOICES)
    expect(BOSS_SFX.arrival.drum).toHaveLength(BOSS_SFX.arrival.chords.length)
  })

  it('the hit thud rises as the boss weakens, clamped to its range', () => {
    expect(bossHitHz(1)).toBe(BOSS_SFX.hit.baseHz)
    expect(bossHitHz(0)).toBe(BOSS_SFX.hit.topHz)
    expect(bossHitHz(0.5)).toBeGreaterThan(bossHitHz(0.9))
    expect(bossHitHz(-1)).toBe(BOSS_SFX.hit.topHz)
    expect(bossHitHz(2)).toBe(BOSS_SFX.hit.baseHz)
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

describe('kill timbres', () => {
  it('pop keeps the original kill sound', () => {
    expect(KILL_TIMBRES.pop).toMatchObject({ snapS: 0.05, snapDecay: 0.06, pingS: 0.04 })
    expect(killPingHz('pop', 0, 0)).toBeCloseTo(1400)
    expect(killPingHz('pop', 10, 1)).toBeCloseTo(1400 * 1.78, 0)
  })

  it('each family has its own snap length and ping pitch', () => {
    const ts = Object.values(KILL_TIMBRES)
    expect(new Set(ts.map((t) => t.pingHz)).size).toBe(ts.length)
    expect(new Set(ts.map((t) => t.snapS)).size).toBe(ts.length)
    expect(KILL_TIMBRES.crunch.pingHz).toBeLessThan(KILL_TIMBRES.pop.pingHz)
    expect(KILL_TIMBRES.splash.snapDecay).toBeGreaterThan(KILL_TIMBRES.pop.snapDecay)
  })

  it('the combo raises the ping and caps at 10', () => {
    expect(killPingHz('crunch', 5, 0)).toBeGreaterThan(killPingHz('crunch', 0, 0))
    expect(killPingHz('crunch', 30, 0)).toBe(killPingHz('crunch', 10, 0))
  })
})
