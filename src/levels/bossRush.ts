/** Boss Rush (#1011): every level's boss back to back in campaign order against the clock, each stage with no waves. */
import type { BossType } from '@/types/level'

/** Seconds of ride each stage starts before its boss arrives: the boss's tell and a look at the track. */
export const STAGE_LEAD_SECONDS = 5

export const RUSH_STARS = 3

export interface RushLevel {
  id: string
  boss?: { type: BossType; at: number }
}

export interface RushStage {
  levelId: string
  /** Level time the stage's ride and timer start at. */
  startAt: number
}

/** In the order given: the campaign's, `getAllLevels()`. */
export function rushStages(levels: readonly RushLevel[]): RushStage[] {
  return levels.flatMap((l) => (l.boss ? [{ levelId: l.id, startAt: Math.max(0, l.boss.at - STAGE_LEAD_SECONDS) }] : []))
}

export function rushUnlocked(levels: readonly Pick<RushLevel, 'id'>[], stars: (levelId: string) => number): boolean {
  return levels.length > 0 && levels.every((l) => stars(l.id) >= RUSH_STARS)
}

/** `endedAt` is its boss's clear or the timer's end. */
export function stageSeconds(stage: RushStage, endedAt: number): number {
  return Math.max(0, endedAt - stage.startAt)
}

/** Stages behind a rush that ended on stage `stage` (0-based), its boss beaten or not. */
export function stagesCleared(stage: number, bossBeaten: boolean): number {
  return stage + (bossBeaten ? 1 : 0)
}

export function rushComplete(stage: number, bossBeaten: boolean, total: number): boolean {
  return stagesCleared(stage, bossBeaten) === total
}

export function isNewBest(seconds: number, best: number | null): boolean {
  return best === null || seconds < best
}

/** The saved best after a rush: only a whole rush (every stage cleared) sets a time. */
export function bestAfter(best: number | null, seconds: number, complete: boolean): number | null {
  return complete && isNewBest(seconds, best) ? seconds : best
}

export function sanitizeRushBest(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

/** `1:23.4`: minutes, seconds and tenths (rounded down, so a shown time is never better than the run). */
export function formatRushTime(seconds: number): string {
  const tenths = Math.floor(Math.max(0, seconds) * 10 + 1e-6)
  const minutes = Math.floor(tenths / 600)
  const rest = tenths - minutes * 600
  const secs = Math.floor(rest / 10)
  return `${minutes}:${String(secs).padStart(2, '0')}.${rest % 10}`
}
