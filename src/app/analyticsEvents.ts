import { getLevelConfig } from '@/levels/LevelRegistry'
import { computeStars } from '@/levels/scoring'
import type { GamePhase } from '@/types/game'
import { isInRun } from '@/store/startPhase'
import type { RunMode } from '@/store/useGameStore'
import type { ShareMethod } from '@/ui/share'

/** At most 2 properties per event (Vercel Pro), no free text; keep docs/marketing/README.md in sync. */
export type AnalyticsEvent =
  | { name: 'level_start'; props: { level: string; mode: RunMode['mode'] } }
  | { name: 'level_complete'; props: { level: string; stars: number } }
  /** `progress_pct`: share of the level timer used, floored to tens. */
  | { name: 'level_quit'; props: { level: string; progress_pct: number } }
  | { name: 'share'; props: { level: string; method: ShareMethod } }

/** Bus event the results screen emits on a completed share: `(levelId, method)`. */
export const SHARED_EVENT = 'results:shared'

export function shareEvent(level: string, method: ShareMethod): AnalyticsEvent {
  return { name: 'share', props: { level, method } }
}

export interface RunSnapshot {
  phase: GamePhase
  currentLevel: string | null
  runMode: RunMode
  score: number
  timeRemaining: number
}

export function tensPercent(fraction: number): number {
  return Math.min(100, Math.max(0, Math.floor(fraction * 10) * 10))
}

export function analyticsEventFor(prev: RunSnapshot, next: RunSnapshot): AnalyticsEvent | null {
  if (prev.phase === next.phase) return null
  const config = next.currentLevel ? getLevelConfig(next.currentLevel) : undefined
  if (!config) return null
  const level = config.id

  if (isInRun(next.phase) && !isInRun(prev.phase)) {
    return { name: 'level_start', props: { level, mode: next.runMode.mode } }
  }
  if (next.phase === 'results' && prev.phase === 'playing') {
    return {
      name: 'level_complete',
      props: { level, stars: computeStars(next.score, config.maxScore, config.starThresholds) },
    }
  }
  if (isInRun(prev.phase) && (next.phase === 'levelSelect' || next.phase === 'title')) {
    return {
      name: 'level_quit',
      props: { level, progress_pct: tensPercent(1 - next.timeRemaining / config.timerSeconds) },
    }
  }
  return null
}
