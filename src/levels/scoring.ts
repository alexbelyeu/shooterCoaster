/**
 * Pure scoring helpers shared by gameplay (EnemySpawner), the results screen and
 * unit tests. No React, three.js or DOM imports: keep it that way so it can be
 * tested under plain Node.
 */
import type { EnemyType, EnemyWave } from '@/types/level'
import { bossMaxScore, type BossSpec } from '@/entities/bosses/bossModel'

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

/** Σ(count × SCORE_VALUES[type]) over every wave, plus the boss's weak points and reward: the no-combo, kill-everything score. */
export function computeMaxScore(waves: readonly EnemyWave[], boss?: BossSpec): number {
  return waves.reduce((sum, w) => sum + w.count * SCORE_VALUES[w.type], boss ? bossMaxScore(boss) : 0)
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

export interface NextStar {
  /** 1-3 */
  stars: number
  points: number
}

/** The star above the one `score` earns (per `computeStars`) and the whole points still needed for it; null with all stars or no maxScore. */
export function nextStar(
  score: number,
  maxScore: number,
  thresholds: readonly [number, number, number],
): NextStar | null {
  const earned = computeStars(score, maxScore, thresholds)
  if (!(maxScore > 0) || earned === 3) return null
  // The epsilon keeps a float product like 0.55 × 100 = 55.00000000000001 from asking for a point too many.
  const needed = thresholds[earned] * maxScore - score
  return { stars: earned + 1, points: Math.max(1, Math.ceil(needed - 1e-9)) }
}
