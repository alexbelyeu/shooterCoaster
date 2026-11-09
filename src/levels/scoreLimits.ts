/** The most a run can score on each level, for the online leaderboard's server checks: generated into `api/_lib/levelLimits.ts`. */
import type { LevelConfig } from '@/types/level'
import { BOSS_SPECS } from '@/entities/bosses/bossSpecs'
import { COMBO_TIERS, TOP_TIER } from '@/combat/comboTiers'
import { getAllLevels } from './LevelRegistry'
import { GOLDEN_BALLOON, SCORE_VALUES, goldenBalloonCount } from './scoring'

export interface ScoreLimits {
  /** Every kill at the top combo multiplier, golden balloons and a boss's projectiles included (`maxScore` leaves them out). */
  maxScore: number
  maxKills: number
  /** The most one kill can score at the top multiplier: the best enemy, or the boss's last weak point with its reward. */
  maxKillPoints: number
}

export function scoreLimits(level: LevelConfig): ScoreLimits {
  const multiplier = COMBO_TIERS[TOP_TIER].multiplier
  const golden = goldenBalloonCount(level.biome)
  const boss = level.boss ? BOSS_SPECS[level.boss.type] : undefined
  const thrown = boss?.projectiles
  const killPoints = [
    ...level.enemies.map((w) => SCORE_VALUES[w.type]),
    ...(golden > 0 ? [GOLDEN_BALLOON.score] : []),
    ...(boss ? boss.weakPoints.map((w) => w.score + boss.reward) : []),
    ...(thrown ? [thrown.score] : []),
  ]
  const bonus = golden * GOLDEN_BALLOON.score + (thrown ? thrown.max * thrown.score : 0)
  return {
    maxScore: (level.maxScore + bonus) * multiplier,
    maxKills: level.enemies.reduce((n, w) => n + w.count, golden + (boss?.weakPoints.length ?? 0) + (thrown?.max ?? 0)),
    maxKillPoints: Math.max(0, ...killPoints) * multiplier,
  }
}

export function campaignScoreLimits(): Record<string, ScoreLimits> {
  return Object.fromEntries(getAllLevels().map((level) => [level.id, scoreLimits(level)]))
}
