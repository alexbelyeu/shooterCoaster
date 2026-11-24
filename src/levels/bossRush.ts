/**
 * Boss Rush (#1011): every level's boss back to back in campaign order, one run against the clock. Each stage rides its
 * level from a few seconds before the boss arrives, with no waves; beating the boss moves on to the next stage, the
 * timer running out on one ends the rush. Open once every level has all its stars; the best time is kept per browser.
 */
import type { BossType } from '@/types/level'

/** Seconds of ride each stage starts before its boss arrives: the boss's tell and a look at the track. */
export const STAGE_LEAD_SECONDS = 5

/** Stars every level needs before the rush opens. */
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

/** Every level with a boss, in the order given (the campaign's, `getAllLevels()`). */
export function rushStages(levels: readonly RushLevel[]): RushStage[] {
  return levels.flatMap((l) => (l.boss ? [{ levelId: l.id, startAt: Math.max(0, l.boss.at - STAGE_LEAD_SECONDS) }] : []))
}

/** Open once every level has `RUSH_STARS`; `stars` reads a level's saved best. */
export function rushUnlocked(levels: readonly Pick<RushLevel, 'id'>[], stars: (levelId: string) => number): boolean {
  return levels.length > 0 && levels.every((l) => stars(l.id) >= RUSH_STARS)
}

/** Level seconds a stage took: from its start to `endedAt` (its boss's clear, or the timer's end). */
export function stageSeconds(stage: RushStage, endedAt: number): number {
  return Math.max(0, endedAt - stage.startAt)
}

/** Stages behind a rush that ended on stage `stage` (0-based), its boss beaten or not. */
export function stagesCleared(stage: number, bossBeaten: boolean): number {
  return stage + (bossBeaten ? 1 : 0)
}

/** A finished rush's time beats the saved best (none yet counts as beaten). */
export function isNewBest(seconds: number, best: number | null): boolean {
  return best === null || seconds < best
}

/** The saved best after a rush: only a whole rush (every stage cleared) sets a time. */
export function bestAfter(best: number | null, seconds: number, complete: boolean): number | null {
  return complete && isNewBest(seconds, best) ? seconds : best
}

/** A saved best read back from storage: a positive number of seconds, else none. */
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
