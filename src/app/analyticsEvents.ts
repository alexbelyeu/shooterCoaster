import { getLevelConfig } from '@/levels/LevelRegistry'
import { computeStars } from '@/levels/scoring'
import type { GamePhase } from '@/types/game'

/** At most 2 properties per event (Vercel Pro), no free text; keep docs/marketing/README.md in sync. */
export type AnalyticsEvent =
  | { name: 'level_start'; props: { level: string } }
  | { name: 'level_complete'; props: { level: string; stars: number } }
  /** `progress_pct`: share of the level timer used, floored to tens. */
  | { name: 'level_quit'; props: { level: string; progress_pct: number } }

export interface RunSnapshot {
  phase: GamePhase
  currentLevel: string | null
  score: number
  timeRemaining: number
}

const inRun = (phase: GamePhase) => phase === 'countdown' || phase === 'playing' || phase === 'paused'

export function tensPercent(fraction: number): number {
  return Math.min(100, Math.max(0, Math.floor(fraction * 10) * 10))
}

export function analyticsEventFor(prev: RunSnapshot, next: RunSnapshot): AnalyticsEvent | null {
  if (prev.phase === next.phase) return null
  const config = next.currentLevel ? getLevelConfig(next.currentLevel) : undefined
  if (!config) return null
  const level = config.id

  if (inRun(next.phase) && !inRun(prev.phase)) {
    return { name: 'level_start', props: { level } }
  }
  if (next.phase === 'results' && prev.phase === 'playing') {
    return {
      name: 'level_complete',
      props: { level, stars: computeStars(next.score, config.maxScore, config.starThresholds) },
    }
  }
  if (inRun(prev.phase) && (next.phase === 'levelSelect' || next.phase === 'title')) {
    return {
      name: 'level_quit',
      props: { level, progress_pct: tensPercent(1 - next.timeRemaining / config.timerSeconds) },
    }
  }
  return null
}
