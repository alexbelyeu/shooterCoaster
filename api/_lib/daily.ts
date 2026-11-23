/** The Daily Run's World board (#854): which day a daily score may be for, on the server's own clock. Mirrors src/levels/daily.ts (`daily.test.ts` holds them together). */

const DAY_MS = 86_400_000
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

/** `dailyLevel`'s rotation in src/levels/daily.ts. */
export const DAILY_LEVELS = ['level1', 'level2', 'level3'] as const

const dayOf = (now: number): string => new Date(now).toISOString().slice(0, 10)

/** A real UTC date as `YYYY-MM-DD` (`dailyKey`'s format). */
export function isDayKey(v: unknown): v is string {
  if (typeof v !== 'string' || !DAY_KEY.test(v)) return false
  const t = Date.parse(`${v}T00:00:00Z`)
  return Number.isFinite(t) && dayOf(t) === v
}

export const dayLevel = (key: string): string => DAILY_LEVELS[Math.round(Date.parse(`${key}T00:00:00Z`) / DAY_MS) % DAILY_LEVELS.length]

/**
 * Why a daily score for `day` on `level` is refused, or null to take it: only today's or yesterday's daily (UTC, from
 * `now`), so a run started before midnight still counts, and only on that day's level.
 */
export function dailyError(day: unknown, level: string, now: number): string | null {
  if (!isDayKey(day)) return 'bad daily'
  if (day !== dayOf(now) && day !== dayOf(now - DAY_MS)) return 'daily closed'
  if (dayLevel(day) !== level) return "not that day's level"
  return null
}
