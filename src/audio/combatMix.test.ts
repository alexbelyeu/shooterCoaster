import { describe, expect, it } from 'vitest'
import { COMBO_TIERS, FRENZY, TOP_TIER, frenzyTimeScale } from '@/combat/comboTiers'
import { MAX_INTENSITY } from './scrim/layers'
import { applyCombatMix } from './combatMix'

function mix(comboCount: number, timeScale = 1, playing = true) {
  const got = { duck: false, lift: false, intensity: -1 }
  applyCombatMix(
    { duck: (on) => (got.duck = on), frenzyLift: (on) => (got.lift = on), intensity: (n) => (got.intensity = n) },
    comboCount, timeScale, playing,
  )
  return got
}

describe('applyCombatMix', () => {
  it('asks for the combo tier as the intensity, FRENZY at the top', () => {
    expect(COMBO_TIERS.map((t) => mix(t.minCount).intensity)).toEqual([0, 1, 2, 3])
    expect(mix(0).intensity).toBe(0)
    expect(mix(COMBO_TIERS[TOP_TIER].minCount).intensity).toBe(MAX_INTENSITY)
  })

  it('holds the FRENZY lift only while playing at the top tier', () => {
    const top = COMBO_TIERS[TOP_TIER].minCount
    expect([mix(top - 1).lift, mix(top).lift, mix(top + 10).lift, mix(top, 1, false).lift]).toEqual([false, true, true, false])
  })

  it('ducks the music for exactly as long as the FRENZY slow-mo runs', () => {
    const ducked = (t: number) => mix(COMBO_TIERS[TOP_TIER].minCount, frenzyTimeScale(t)).duck
    expect([ducked(-Infinity), ducked(0), ducked(0.01), ducked(FRENZY.durationS - 0.01), ducked(FRENZY.durationS)]).toEqual([
      false, false, true, true, false,
    ])
  })
})
