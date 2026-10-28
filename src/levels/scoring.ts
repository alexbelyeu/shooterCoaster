/**
 * Pure scoring helpers shared by gameplay (EnemySpawner), the results screen and
 * unit tests. No React, three.js or DOM imports: keep it that way so it can be
 * tested under plain Node.
 */
import type { EnemyType, EnemyWave } from '@/types/level'

/** Points awarded per kill, before the combo multiplier (`combat/comboTiers.ts`). */
export const SCORE_VALUES: Record<EnemyType, number> = {
  balloon: 13,
  crow: 15,
  scorpion: 20,
  shark: 25,
  jellyfish: 18,
  flyingFish: 12,
  snowman: 30,
  snowmanScout: 15,
  snowmanBrute: 50,
  emberWisp: 12,
  lavaGolem: 35,
  fireImp: 18,
  infernalDrake: 60,
}

/** Σ(count × SCORE_VALUES[type]) over every wave: the no-combo, kill-everything score. */
export function computeMaxScore(waves: readonly EnemyWave[]): number {
  return waves.reduce((sum, w) => sum + w.count * SCORE_VALUES[w.type], 0)
}

/**
 * Stars earned for `score` against `maxScore`. Thresholds are fractions of
 * maxScore for 1, 2 and 3 stars. Returns 0-3. `score` includes the combo
 * multiplier while `maxScore` is the base, so the fraction can pass 1: it is clamped there.
 */
export function computeStars(
  score: number,
  maxScore: number,
  thresholds: readonly [number, number, number],
): 0 | 1 | 2 | 3 {
  if (!(maxScore > 0)) return 0
  const pct = Math.min(1, score / maxScore)
  if (pct >= thresholds[2]) return 3
  if (pct >= thresholds[1]) return 2
  if (pct >= thresholds[0]) return 1
  return 0
}
