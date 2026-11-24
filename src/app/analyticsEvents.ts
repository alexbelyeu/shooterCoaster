import { getLevelConfig } from '@/levels/LevelRegistry'
import { RUN_SECONDS } from '@/levels/pacing'
import { runStars } from '@/levels/scoring'
import type { GamePhase, RunFrom, RunMode } from '@/types/game'
import { isInRun } from '@/store/startPhase'
import type { ShareMethod } from '@/ui/share'

/** At most 2 properties per event (Vercel Pro), no free text; keep docs/marketing/README.md in sync. */
export type AnalyticsEvent =
  /** `from`: the screen that started it, `daily` for any Daily Run (it replaced `mode` within the cap, #329). */
  | { name: 'level_start'; props: { level: string; from: RunFrom | 'daily' } }
  | { name: 'level_complete'; props: { level: string; stars: number } }
  /** `progress_pct`: share of the level timer used, floored to tens. */
  | { name: 'level_quit'; props: { level: string; progress_pct: number } }
  /** `level` is `daily` for a Daily Run's share (#268), like `level_start`'s `from`: the day's level follows from its date. */
  | { name: 'share'; props: { level: string; method: ShareMethod } }

/** Bus event the results screen emits on a completed share: `(levelId, method, daily)`. */
export const SHARED_EVENT = 'results:shared'

export function shareEvent(level: string, method: ShareMethod, daily: boolean): AnalyticsEvent {
  return { name: 'share', props: { level: daily ? 'daily' : level, method } }
}

export interface RunSnapshot {
  phase: GamePhase
  /** Bumped by every `startRun`: a Restart from the pause menu starts a run without leaving one. */
  runId: number
  currentLevel: string | null
  runMode: RunMode
  runFrom: RunFrom
  score: number
  timeRemaining: number
}

export function tensPercent(fraction: number): number {
  return Math.min(100, Math.max(0, Math.floor(fraction * 10) * 10))
}

export function analyticsEventFor(prev: RunSnapshot, next: RunSnapshot): AnalyticsEvent | null {
  const newRun = next.runId !== prev.runId
  if (prev.phase === next.phase && !newRun) return null
  const config = next.currentLevel ? getLevelConfig(next.currentLevel) : undefined
  if (!config) return null
  const level = config.id

  if (isInRun(next.phase) && (newRun || !isInRun(prev.phase))) {
    return { name: 'level_start', props: { level, from: next.runMode.mode === 'daily' ? 'daily' : next.runFrom } }
  }
  if (next.phase === 'results' && prev.phase === 'playing') {
    return {
      name: 'level_complete',
      props: { level, stars: runStars(next.score, config) },
    }
  }
  if (isInRun(prev.phase) && (next.phase === 'levelSelect' || next.phase === 'title')) {
    return {
      name: 'level_quit',
      props: { level, progress_pct: tensPercent(1 - next.timeRemaining / RUN_SECONDS) },
    }
  }
  return null
}
