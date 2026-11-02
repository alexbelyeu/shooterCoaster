/** Daily Run: one seeded run per UTC day, so every player shares it. */
import { hashString } from '@/utils/rng'
import type { ScoreEntry } from '@/types/game'

/** The levels the daily rotates through: the first three, so a new visitor can play it (campaign locks stay). */
export const DAILY_LEVELS = ['level1', 'level2', 'level3'] as const

/** Daily bests older than this many days are dropped on save. */
export const DAILY_KEEP_DAYS = 30

const DAY_MS = 86_400_000

/** Consecutive UTC days with a finished daily run; `lastKey` is the most recent one. */
export interface DailyStreak {
  count: number
  lastKey: string | null
}

/** Storage key of a date's UTC day: `YYYY-MM-DD`. */
export function dailyKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

const keyOf = (date: Date | string): string => (typeof date === 'string' ? date : dailyKey(date))

function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS)
}

export function dailySeed(date: Date | string): number {
  return hashString(`daily-${keyOf(date)}`)
}

export function dailyLevel(date: Date | string): (typeof DAILY_LEVELS)[number] {
  return DAILY_LEVELS[dayNumber(keyOf(date)) % DAILY_LEVELS.length]
}

/** The streak after finishing a daily on `key`: same day keeps it, the next day extends it, a gap restarts it. */
export function extendStreak(streak: DailyStreak, key: string): DailyStreak {
  if (streak.lastKey === key) return streak
  const consecutive = streak.lastKey !== null && dayNumber(key) - dayNumber(streak.lastKey) === 1
  return { count: consecutive ? streak.count + 1 : 1, lastKey: key }
}

/** The streak as of `todayKey`: still alive if the last daily was today or yesterday, else 0. */
export function currentStreak(streak: DailyStreak, todayKey: string): number {
  if (streak.lastKey === null) return 0
  const gap = dayNumber(todayKey) - dayNumber(streak.lastKey)
  return gap === 0 || gap === 1 ? streak.count : 0
}

export function pruneDaily(saved: Record<string, ScoreEntry>, todayKey: string): Record<string, ScoreEntry> {
  const today = dayNumber(todayKey)
  const kept: Record<string, ScoreEntry> = {}
  for (const [key, entry] of Object.entries(saved)) {
    if (today - dayNumber(key) < DAILY_KEEP_DAYS) kept[key] = entry
  }
  return kept
}
