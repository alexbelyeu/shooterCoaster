/** The `scores` table over Supabase's REST API: plain fetch rather than supabase-js, one less client to keep out of the browser. */
import type { PublicEntry, Submission } from './rules.js'
import { BOARD_SIZE } from './rules.js'

export class DbError extends Error {}

export interface ScoresDb {
  top(level: string): Promise<PublicEntry[]>
  /** PostgREST filters: `{ column: 'op.value' }`. */
  count(filters: Record<string, string>): Promise<number>
  insert(row: Submission & { ipHash: string }): Promise<void>
}

const TIMEOUT_MS = 4000

export function scoresDb(env: Record<string, string | undefined>, fetchImpl: (url: string, init: RequestInit) => Promise<Response> = (url, init) => fetch(url, init)): ScoresDb | null {
  const url = env.SUPABASE_URL?.trim().replace(/\/+$/, '')
  const key = env.SUPABASE_SECRET_KEY?.trim()
  if (!url || !key) return null
  const table = `${url}/rest/v1/scores`
  // A secret key goes in `apikey` alone: the gateway turns it into the service_role JWT.
  const headers = { apikey: key }

  async function call(query: string, init: RequestInit): Promise<Response> {
    let res: Response
    try {
      res = await fetchImpl(`${table}${query}`, { ...init, headers: { ...headers, ...init.headers }, signal: AbortSignal.timeout(TIMEOUT_MS) })
    } catch {
      throw new DbError('unreachable')
    }
    if (!res.ok) throw new DbError(`status ${res.status}`)
    return res
  }

  const filterQuery = (filters: Record<string, string>) =>
    Object.entries(filters)
      .map(([col, f]) => `${col}=${encodeURIComponent(f)}`)
      .join('&')

  return {
    async top(level) {
      const res = await call(`?select=initials,score,created_at&level_id=eq.${encodeURIComponent(level)}&order=score.desc,created_at.asc&limit=${BOARD_SIZE}`, { method: 'GET' })
      const rows: unknown = await res.json().catch(() => null)
      if (!Array.isArray(rows)) throw new DbError('bad rows')
      return rows.map((r: { initials: string; score: number; created_at: string }) => ({ initials: r.initials, score: r.score, at: r.created_at }))
    },
    async count(filters) {
      const res = await call(`?select=id&${filterQuery(filters)}`, { method: 'HEAD', headers: { Prefer: 'count=exact' } })
      const total = Number(res.headers.get('content-range')?.split('/')[1])
      if (!Number.isInteger(total)) throw new DbError('no count')
      return total
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
