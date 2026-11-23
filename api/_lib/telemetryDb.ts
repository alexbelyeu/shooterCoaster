/** The `telemetry_reports` table (#373; supabase/migrations/0002_telemetry.sql). */
import type { Report, ReportRow } from './telemetryRules.js'
import { countOf, DbError, filterQuery, restTable, type FetchImpl } from './supabaseRest.js'

const SELECT = 'created_at,client_version,touch,gpu,context_lost,errors,levels'
/**
 * Until Alex runs `0003_telemetry_webgpu.sql` the `webgpu` column is missing (#850): PostgREST answers an insert
 * naming it with PGRST204 and a select naming it with Postgres' undefined_column. Both retry once without it.
 */
const MISSING_COLUMN_WRITE = 'PGRST204'
const MISSING_COLUMN_READ = '42703'

export interface TelemetryDb {
  insert(report: Report & { ipHash: string }): Promise<void>
  count(filters: Record<string, string>): Promise<number>
  recent(sinceIso: string, limit: number): Promise<ReportRow[]>
  deleteBefore(iso: string): Promise<void>
}

export function telemetryDb(env: Record<string, string | undefined>, fetchImpl?: FetchImpl): TelemetryDb | null {
  const call = restTable(env, 'telemetry_reports', fetchImpl)
  if (!call) return null
  return {
    async insert(r) {
      const row = {
        client_version: r.version,
        touch: r.touch,
        cores: r.cores,
        gpu: r.gpu,
        webgpu: r.webgpu,
        context_lost: r.contextLost,
        errors: r.errors,
        levels: r.levels,
        ip_hash: r.ipHash,
      }
      const post = (body: object) => call('', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(body) })
      try {
        await post(row)
      } catch (e) {
        if (!(e instanceof DbError && e.code === MISSING_COLUMN_WRITE)) throw e
        const { webgpu: _, ...withoutWebgpu } = row
        await post(withoutWebgpu)
      }
    },
    async count(filters) {
      return countOf(await call(`?select=id&${filterQuery(filters)}`, { method: 'HEAD', headers: { Prefer: 'count=exact' } }))
    },
    async recent(sinceIso, limit) {
      const read = (select: string) =>
        call(`?select=${select}&${filterQuery({ created_at: `gte.${sinceIso}` })}&order=created_at.desc&limit=${limit}`, { method: 'GET' })
      let res: Response
      try {
        res = await read(`${SELECT},webgpu`)
      } catch (e) {
        if (!(e instanceof DbError && e.code === MISSING_COLUMN_READ)) throw e
        res = await read(SELECT)
      }
      const rows: unknown = await res.json().catch(() => null)
      if (!Array.isArray(rows)) throw new DbError('bad rows')
      return rows as ReportRow[]
    },
    async deleteBefore(iso) {
      await call(`?${filterQuery({ created_at: `lt.${iso}` })}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
    },
  }
}
