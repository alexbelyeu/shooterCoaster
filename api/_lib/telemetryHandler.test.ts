import { describe, expect, it } from 'vitest'
import { DbError } from './supabaseRest'
import { telemetryDb, type TelemetryDb } from './telemetryDb'
import { getSummary, postReport, type TelemetryDeps } from './telemetryHandler'
import type { Report, ReportRow } from './telemetryRules'

const report: Report = {
  version: '0.1.0',
  touch: false,
  cores: 4,
  gpu: null,
  contextLost: 1,
  errors: [{ message: 'boom', frame: '', count: 1 }],
  levels: [],
}

type Stored = Report & { ipHash: string; createdAt: number }

function fakeDb(now: () => number, failing = false): TelemetryDb & { rows: Stored[]; deletedBefore: string[] } {
  const rows: Stored[] = []
  const deletedBefore: string[] = []
  const guard = () => {
    if (failing) throw new DbError('status 540')
  }
  return {
    rows,
    deletedBefore,
    async insert(r) {
      guard()
      rows.push({ ...r, createdAt: now() })
    },
    async count(filters) {
      guard()
      return rows.filter((r) => r.ipHash === filters.ip_hash.slice(3) && r.createdAt >= Date.parse(filters.created_at.slice(4))).length
    },
    async recent(since) {
      guard()
      return rows
        .filter((r) => r.createdAt >= Date.parse(since))
        .map((r): ReportRow => ({
          created_at: new Date(r.createdAt).toISOString(),
          client_version: r.version,
          touch: r.touch,
          gpu: r.gpu,
          context_lost: r.contextLost,
          errors: r.errors,
          levels: r.levels,
        }))
    },
    async deleteBefore(iso) {
      deletedBefore.push(iso)
    },
  }
}

const post = (body: unknown, ip = '203.0.113.7') =>
  new Request('https://scoaster.com/api/telemetry', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

function setup(failing = false) {
  let t = Date.parse('2026-11-07T12:00:00Z')
  const now = () => t
  const db = fakeDb(now, failing)
  const deps: TelemetryDeps = { db, salt: 'secret', now, random: () => 0.5 }
  return { db, deps, advance: (ms: number) => (t += ms) }
}

describe('POST /api/telemetry', () => {
  it('stores a good report under a hashed IP, never the IP itself', async () => {
    const { db, deps } = setup()
    const res = await postReport(post(report), deps)
    expect(res.status).toBe(204)
    expect(db.rows).toHaveLength(1)
    expect(db.rows[0].ipHash).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(db.rows)).not.toContain('203.0.113.7')
  })

  it('drops malformed, oversized and non-JSON bodies', async () => {
    const { db, deps } = setup()
    expect((await postReport(post({ ...report, touch: 'yes' }), deps)).status).toBe(400)
    expect((await postReport(post('{nope'), deps)).status).toBe(400)
    expect((await postReport(post('x'.repeat(7000)), deps)).status).toBe(413)
    expect(db.rows).toHaveLength(0)
  })

  it('rate-limits one IP to 10 reports in 10 minutes, and the hash changes with the day', async () => {
    const { db, deps, advance } = setup()
    for (let i = 0; i < 10; i++) expect((await postReport(post(report), deps)).status).toBe(204)
    expect((await postReport(post(report), deps)).status).toBe(429)
    expect((await postReport(post(report, '198.51.100.1'), deps)).status).toBe(204)
    advance(11 * 60 * 1000)
    expect((await postReport(post(report), deps)).status).toBe(204)
    advance(24 * 3600 * 1000)
    await postReport(post(report), deps)
    expect(db.rows[db.rows.length - 1].ipHash).not.toBe(db.rows[0].ipHash)
  })

  it('now and then deletes rows past 30 days', async () => {
    const { db, deps } = setup()
    await postReport(post(report), deps)
    expect(db.deletedBefore).toEqual([])
    await postReport(post(report), { ...deps, random: () => 0 })
    expect(db.deletedBefore).toEqual(['2026-10-08T12:00:00.000Z'])
  })

  it('answers a bare 503 without a database or when it fails', async () => {
    const { deps } = setup(true)
    for (const d of [{ ...deps, db: null }, deps]) {
      const res = await postReport(post(report), d)
      expect(res.status).toBe(503)
      expect(await res.json()).toEqual({ error: 'unavailable' })
    }
  })
})

describe('GET /api/telemetry', () => {
  it('serves the last 24 hours summarised, CDN-cached', async () => {
    const { deps, advance } = setup()
    await postReport(post(report), deps)
    advance(25 * 3600 * 1000)
    await postReport(post({ ...report, contextLost: 0 }), deps)
    const res = await getSummary(new Request('https://scoaster.com/api/telemetry'), deps)
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toMatch(/s-maxage=\d+/)
    const body = await res.json()
    expect(body).toMatchObject({ sessions: 1, truncated: false, contextLost: { sessions: 0 } })
    expect(body.errors[0]).toMatchObject({ message: 'boom', sessions: 1 })
  })

  it('answers an uncached 503 when the database is missing or failing', async () => {
    const { deps } = setup(true)
    for (const d of [{ ...deps, db: null }, deps]) {
      const res = await getSummary(new Request('https://scoaster.com/api/telemetry'), d)
      expect(res.status).toBe(503)
      expect(res.headers.get('cache-control')).toBe('no-store')
    }
  })
})

describe('telemetryDb', () => {
  const env = { SUPABASE_URL: 'https://abc.supabase.co/', SUPABASE_SECRET_KEY: 'sb_secret_x' }

  it('is null without both env vars', () => {
    expect(telemetryDb({})).toBeNull()
  })

  it('talks to telemetry_reports with the secret key, in the columns of the migration', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const db = telemetryDb(env, async (url, init) => {
      calls.push({ url, init })
      if (init.method === 'GET') return Response.json([])
      return new Response(null, { status: init.method === 'HEAD' ? 200 : 201, headers: { 'content-range': '*/4' } })
    })!
    await db.insert({ ...report, ipHash: 'h' })
    expect(await db.count({ ip_hash: 'eq.h' })).toBe(4)
    expect(await db.recent('2026-11-06T12:00:00.000Z', 3000)).toEqual([])
    await db.deleteBefore('2026-10-08T12:00:00.000Z')
    expect(calls.map((c) => `${c.init.method} ${c.url}`)).toEqual([
      'POST https://abc.supabase.co/rest/v1/telemetry_reports',
      'HEAD https://abc.supabase.co/rest/v1/telemetry_reports?select=id&ip_hash=eq.h',
      'GET https://abc.supabase.co/rest/v1/telemetry_reports?select=created_at,client_version,touch,gpu,context_lost,errors,levels&created_at=gte.2026-11-06T12%3A00%3A00.000Z&order=created_at.desc&limit=3000',
      'DELETE https://abc.supabase.co/rest/v1/telemetry_reports?created_at=lt.2026-10-08T12%3A00%3A00.000Z',
    ])
    expect(Object.keys(JSON.parse(calls[0].init.body as string)).sort()).toEqual(
      ['client_version', 'context_lost', 'cores', 'errors', 'gpu', 'ip_hash', 'levels', 'touch'],
    )
    expect((calls[0].init.headers as Record<string, string>).apikey).toBe('sb_secret_x')
  })

  it('throws DbError on a failed call', async () => {
    const db = telemetryDb(env, async () => new Response('no', { status: 500 }))!
    await expect(db.recent('x', 1)).rejects.toBeInstanceOf(DbError)
  })
})
