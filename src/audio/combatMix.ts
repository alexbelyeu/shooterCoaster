/**
 * How the level's music follows the fight: the combo tier is the score's intensity, the 5× tier holds the FRENZY
 * lift, and any slow-mo ducks the music. Pure: `LevelAudio` applies it every playing frame, `audio:render --mix`
 * on its scripted clock, so the render measures the game's own rule.
 */
import { TOP_TIER, comboTierIndex } from '@/combat/comboTiers'
import { intensityForTier } from './scrim/layers'

export interface CombatMixTargets {
  duck(on: boolean): void
  frenzyLift(on: boolean): void
  intensity(intensity: number): void
}

export function applyCombatMix(out: CombatMixTargets, comboCount: number, timeScale: number, playing: boolean): void {
  const tier = comboTierIndex(comboCount)
  out.duck(timeScale < 1)
  out.frenzyLift(playing && tier === TOP_TIER)
  out.intensity(intensityForTier(tier))
}
