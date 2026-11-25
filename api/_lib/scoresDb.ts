/** The `scores` table of the online leaderboard (#365) and the Daily Run's World board (#854: `day`, null on campaign rows). */
import type { PublicEntry, Submission } from './rules.js'
import { BOARD_SIZE } from './rules.js'
import { countOf, DbError, filterQuery, restTable, type FetchImpl } from './supabaseRest.js'

export { DbError }

/**
 * Until Alex runs `0004_daily_board.sql` the `day` column is missing: a filter on it is Postgres' undefined_column.
 * The campaign board's `day is null` then retries without it (every row is a campaign row); a daily call fails, a 503.
 */
const MISSING_COLUMN_READ = '42703'
/** PostgREST's answer to a write naming a column it doesn't know: `ghost` before `0006_daily_ghost.sql` runs. */
const MISSING_COLUMN_WRITE = 'PGRST204'
export const CAMPAIGN = 'is.null'
/** What `0005_rate_limit.sql`'s trigger raises on an IP's 6th row in 10 minutes. */
export const RATE_LIMITED = 'PT429'

export interface ScoresDb {
  /** The level's best `BOARD_SIZE` rows scoring at most `maxScore`: the campaign's (`day` null) or that day's daily. */
  top(level: string, maxScore: number, day: string | null): Promise<PublicEntry[]>
  /** PostgREST filters: `{ column: 'op.value' }`; `day: CAMPAIGN` counts campaign rows only. */
  count(filters: Record<string, string>): Promise<number>
  /**
   * A daily run carries its `day`; a campaign row leaves it out (null), so it stores before the migration too.
   * A daily's `ghost` (#1042) is dropped, the row kept, until `0006_daily_ghost.sql` adds its column.
   */
  insert(row: Submission & { ipHash: string; day?: string; ghost?: string }): Promise<void>
  /** The ghost of that day's best daily run that has one, scoring at most `maxScore`; null before 0006 runs. */
  ghost(level: string, maxScore: number, day: string): Promise<string | null>
}

export function scoresDb(env: Record<string, string | undefined>, fetchImpl?: FetchImpl): ScoresDb | null {
  const call = restTable(env, 'scores', fetchImpl)
  if (!call) return null
  /** `call` with `filters`, again without a campaign `day` filter when the column isn't there yet. */
  const withDay = async (filters: Record<string, string>, send: (query: string) => Promise<Response>): Promise<Response> => {
    try {
      return await send(filterQuery(filters))
    } catch (e) {
      if (!(e instanceof DbError && e.code === MISSING_COLUMN_READ && filters.day === CAMPAIGN)) throw e
      const { day: _, ...rest } = filters
      return send(filterQuery(rest))
    }
  }
  return {
    async top(level, maxScore, day) {
      const filters = { level_id: `eq.${level}`, score: `lte.${maxScore}`, day: day === null ? CAMPAIGN : `eq.${day}` }
      const res = await withDay(filters, (q) => call(`?select=initials,score,created_at&${q}&order=score.desc,created_at.asc&limit=${BOARD_SIZE}`, { method: 'GET' }))
      const rows: unknown = await res.json().catch(() => null)
      if (!Array.isArray(rows)) throw new DbError('bad rows')
      return rows.map((r: { initials: string; score: number; created_at: string }) => ({ initials: r.initials, score: r.score, at: r.created_at }))
    },
    async count(filters) {
      return countOf(await withDay(filters, (q) => call(`?select=id&${q}`, { method: 'HEAD', headers: { Prefer: 'count=exact' } })))
    },
    async ghost(level, maxScore, day) {
      const q = filterQuery({ level_id: `eq.${level}`, score: `lte.${maxScore}`, day: `eq.${day}`, ghost: 'not.is.null' })
      let res: Response
      try {
        res = await call(`?select=ghost&${q}&order=score.desc,created_at.asc&limit=1`, { method: 'GET' })
      } catch (e) {
        if (e instanceof DbError && e.code === MISSING_COLUMN_READ) return null
        throw e
      }
      const rows: unknown = await res.json().catch(() => null)
      if (!Array.isArray(rows)) throw new DbError('bad rows')
      const ghost: unknown = rows[0]?.ghost
      return typeof ghost === 'string' ? ghost : null
    },
    async insert(row) {
      const send = (ghost: string | undefined) => call('', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({
          level_id: row.level,
          initials: row.initials,
          score: row.score,
          run_seed: row.seed,
          kills: row.kills,
          accuracy: row.accuracy,
          client_version: row.version,
          ip_hash: row.ipHash,
          ...(row.day ? { day: row.day } : {}),
          ...(ghost ? { ghost } : {}),
        }),
      })
      try {
        await send(row.ghost)
      } catch (e) {
        if (!(row.ghost && e instanceof DbError && (e.code === MISSING_COLUMN_WRITE || e.code === MISSING_COLUMN_READ))) throw e
        await send(undefined)
      }
    },
  }
}
