import { describe, expect, it } from 'vitest'
import { getBoard, postScore, type Deps } from './handler'
import type { PublicEntry, Submission } from './rules'
import { DbError, type ScoresDb } from './scoresDb'

type Row = Submission & { ipHash: string; createdAt: number }

/** In-memory `scores` with the filters the handler uses. */
function fakeDb(now: () => number, failing = false): ScoresDb & { rows: Row[] } {
  const rows: Row[] = []
  const guard = () => {
    if (failing) throw new DbError('status 540')
  }
  return {
    rows,
    async top(level) {
      guard()
      return rows
        .filter((r) => r.level === level)
        .sort((a, b) => b.score - a.score || a.createdAt - b.createdAt)
        .slice(0, 10)
        .map((r): PublicEntry => ({ initials: r.initials, score: r.score, at: new Date(r.createdAt).toISOString() }))
    },
    async count(filters) {
      guard()
      return rows.filter((r) => {
        if (filters.ip_hash && r.ipHash !== filters.ip_hash.slice(3)) return false
        if (filters.created_at && r.createdAt < Date.parse(filters.created_at.slice(4))) return false
        if (filters.level_id && r.level !== filters.level_id.slice(3)) return false
        if (filters.score && r.score < Number(filters.score.slice(4))) return false
        return true
      }).length
    },
    async insert(row) {
      guard()
      rows.push({ ...row, createdAt: now() })
    },
  }
}

const run = { level: 'level1', initials: 'ABC', score: 2400, seed: 1, kills: 100, accuracy: 0.8, version: '2.0.0' }
const post = (body: unknown, ip = '1.2.3.4') =>
  new Request('https://scoaster.com/api/leaderboard', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'x-forwarded-for': ip } })
const get = (level: string) => new Request(`https://scoaster.com/api/leaderboard?level=${level}`)

function setup(failing = false) {
  let t = Date.UTC(2026, 10, 5, 12)
  const now = () => t
  const db = fakeDb(now, failing)
  const deps: Deps = { db, salt: 'secret', now }
  return { db, deps, advance: (ms: number) => (t += ms) }
}

describe('POST /api/leaderboard', () => {
  it('stores a valid run and answers its rank and the fresh top 10', async () => {
    const { db, deps } = setup()
    await postScore(post({ ...run, score: 3000 }, '9.9.9.9'), deps)
    const res = await postScore(post(run), deps)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rank).toBe(2)
    expect(body.top.map((e: PublicEntry) => e.score)).toEqual([3000, 2400])
    expect(db.rows[1].ipHash).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(db.rows)).not.toContain('1.2.3.4')
  })

  it('rejects a forged score, bad initials and junk with 400 and stores nothing', async () => {
    const { db, deps } = setup()
    for (const body of [{ ...run, score: 10_000_000 }, { ...run, initials: 'ab' }, 'not json', [run]]) {
      expect((await postScore(post(body), deps)).status).toBe(400)
    }
    expect(db.rows).toHaveLength(0)
  })

  it('refuses a body over 2 KB', async () => {
    const { deps } = setup()
    expect((await postScore(post({ ...run, pad: 'x'.repeat(3000) }), deps)).status).toBe(413)
  })

  it('refuses the 6th submission from one IP in 10 minutes, and takes it again after', async () => {
    const { db, deps, advance } = setup()
    for (let i = 0; i < 5; i++) expect((await postScore(post(run), deps)).status).toBe(200)
    expect((await postScore(post(run), deps)).status).toBe(429)
    expect((await postScore(post(run, '5.5.5.5'), deps)).status).toBe(200)
    advance(10 * 60 * 1000 + 1)
    expect((await postScore(post(run), deps)).status).toBe(200)
    expect(db.rows).toHaveLength(7)
  })

  it('answers a bare 503 without env vars or with the database down', async () => {
    for (const deps of [{ ...setup().deps, db: null }, setup(true).deps]) {
      const res = await postScore(post(run), deps)
      expect(res.status).toBe(503)
      expect(await res.json()).toEqual({ error: 'unavailable' })
    }
  })
})

describe('GET /api/leaderboard', () => {
  it('serves the top 10 with a short CDN cache', async () => {
    const { deps } = setup()
    for (let i = 1; i <= 12; i++) await postScore(post({ ...run, score: i * 100 }, `10.0.0.${i}`), deps)
    const res = await getBoard(get('level1'), deps)
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('public, s-maxage=30, stale-while-revalidate=300')
    const { top } = await res.json()
    expect(top).toHaveLength(10)
    expect(top[0]).toEqual({ initials: 'ABC', score: 1200, at: expect.any(String) })
  })

  it('400s an unknown level and 503s (uncached) when the board is unavailable', async () => {
    expect((await getBoard(get('nope'), setup().deps)).status).toBe(400)
    for (const deps of [{ ...setup().deps, db: null }, setup(true).deps]) {
      const res = await getBoard(get('level1'), deps)
      expect(res.status).toBe(503)
      expect(res.headers.get('cache-control')).toBe('no-store')
    }
  })
})
