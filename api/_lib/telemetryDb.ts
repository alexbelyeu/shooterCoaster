/** The `telemetry_reports` table (#373; supabase/migrations/0002_telemetry.sql). */
import type { Report, ReportRow } from './telemetryRules.js'
import { countOf, DbError, filterQuery, restTable, type FetchImpl } from './supabaseRest.js'

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
      await call('', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({
          client_version: r.version,
          touch: r.touch,
          cores: r.cores,
          gpu: r.gpu,
          context_lost: r.contextLost,
          errors: r.errors,
          levels: r.levels,
          ip_hash: r.ipHash,
        }),
      })
    },
    async count(filters) {
      return countOf(await call(`?select=id&${filterQuery(filters)}`, { method: 'HEAD', headers: { Prefer: 'count=exact' } }))
    },
    async recent(sinceIso, limit) {
      const select = 'created_at,client_version,touch,gpu,context_lost,errors,levels'
      const res = await call(`?select=${select}&${filterQuery({ created_at: `gte.${sinceIso}` })}&order=created_at.desc&limit=${limit}`, { method: 'GET' })
      const rows: unknown = await res.json().catch(() => null)
      if (!Array.isArray(rows)) throw new DbError('bad rows')
      return rows as ReportRow[]
    },
    async deleteBefore(iso) {
      await call(`?${filterQuery({ created_at: `lt.${iso}` })}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
    },
  }
}
