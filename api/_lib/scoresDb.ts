/** The `scores` table of the online leaderboard (#365). */
import type { PublicEntry, Submission } from './rules.js'
import { BOARD_SIZE } from './rules.js'
import { countOf, DbError, filterQuery, restTable, type FetchImpl } from './supabaseRest.js'

export { DbError }

export interface ScoresDb {
  top(level: string): Promise<PublicEntry[]>
  /** PostgREST filters: `{ column: 'op.value' }`. */
  count(filters: Record<string, string>): Promise<number>
  insert(row: Submission & { ipHash: string }): Promise<void>
}

export function scoresDb(env: Record<string, string | undefined>, fetchImpl?: FetchImpl): ScoresDb | null {
  const call = restTable(env, 'scores', fetchImpl)
  if (!call) return null
  return {
    async top(level) {
      const res = await call(`?select=initials,score,created_at&level_id=eq.${encodeURIComponent(level)}&order=score.desc,created_at.asc&limit=${BOARD_SIZE}`, { method: 'GET' })
      const rows: unknown = await res.json().catch(() => null)
      if (!Array.isArray(rows)) throw new DbError('bad rows')
      return rows.map((r: { initials: string; score: number; created_at: string }) => ({ initials: r.initials, score: r.score, at: r.created_at }))
    },
    async count(filters) {
      return countOf(await call(`?select=id&${filterQuery(filters)}`, { method: 'HEAD', headers: { Prefer: 'count=exact' } }))
    },
    async insert(row) {
      await call('', {
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
        }),
      })
    },
  }
}
