import { describe, expect, it } from 'vitest'
import { getBoard, postScore, type Deps } from './handler'
import type { PublicEntry, Submission } from './rules'
import { DbError, RATE_LIMITED, scoresDb, type ScoresDb } from './scoresDb'
import { MAX_GHOST_CHARS, RATE_LIMIT } from './rules'
import fs from 'node:fs'
import path from 'node:path'
import { LEVEL_LIMITS } from './levelLimits'
import { DAILY_LEVELS, dayLevel } from './daily'

type Row = Submission & { ipHash: string; createdAt: number; day?: string; ghost?: string }

/**
 * In-memory `scores` with the filters the handler uses. `noDayColumn`: before `0004_daily_board.sql`, where every
 * daily call throws and the campaign's (scoresDb retries its `day is null` without it) still work.
 * `rateTrigger`: after `0005_rate_limit.sql`, whose trigger refuses an IP's insert past the limit.
 */
function fakeDb(now: () => number, failing = false, noDayColumn = false, rateTrigger = false): ScoresDb & { rows: Row[] } {
  const rows: Row[] = []
  const guard = (daily = false) => {
    if (failing) throw new DbError('status 540')
    if (noDayColumn && daily) throw new DbError('status 400', '42703')
  }
  return {
    rows,
    async top(level, maxScore, day) {
      guard(day !== null)
      return rows
        .filter((r) => r.level === level && r.score <= maxScore && (r.day ?? null) === day)
        .sort((a, b) => b.score - a.score || a.createdAt - b.createdAt)
        .slice(0, 10)
        .map((r): PublicEntry => ({ initials: r.initials, score: r.score, at: new Date(r.createdAt).toISOString() }))
    },
    async ghost(level, maxScore, day) {
      guard(true)
      const best = rows
        .filter((r) => r.level === level && r.score <= maxScore && r.day === day && r.ghost)
        .sort((a, b) => b.score - a.score || a.createdAt - b.createdAt)[0]
      return best?.ghost ?? null
    },
    async count(filters) {
      guard(filters.day?.startsWith('eq.'))
      return rows.filter((r) => {
        if (filters.day && (filters.day === 'is.null' ? r.day !== undefined : r.day !== filters.day.slice(3))) return false
        if (filters.ip_hash && r.ipHash !== filters.ip_hash.slice(3)) return false
        if (filters.created_at && r.createdAt < Date.parse(filters.created_at.slice(4))) return false
        if (filters.level_id && r.level !== filters.level_id.slice(3)) return false
        if (filters.score && r.score < Number(filters.score.slice(4))) return false
        if (filters.and && r.score > Number(/^\(score\.lte\.(\d+)\)$/.exec(filters.and)?.[1])) return false
        return true
      }).length
    },
    async insert(row) {
      guard(row.day !== undefined)
      const recent = rows.filter((r) => r.ipHash === row.ipHash && r.createdAt >= now() - RATE_LIMIT.windowMs).length
      if (rateTrigger && recent >= RATE_LIMIT.max) throw new DbError('status 429', RATE_LIMITED)
      rows.push({ ...row, createdAt: now() })
    },
  }
}

const run = { level: 'level1', initials: 'ABC', score: 2400, seed: 1, kills: 100, accuracy: 0.8, version: '2.0.0' }
const post = (body: unknown, ip = '1.2.3.4') =>
  new Request('https://scoaster.com/api/leaderboard', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'x-forwarded-for': ip } })
/** A row from before the 60 s rules (#452): a long run over what a 60 s run can score, straight in the table. */
const longRun = (level: string, createdAt: number): Row => ({
  ...run, level, initials: 'OLD', score: LEVEL_LIMITS[level].maxScore + 500, ipHash: 'ff', createdAt,
})
const get = (level: string) => new Request(`https://scoaster.com/api/leaderboard?level=${level}`)
const getDaily = (day: string) => new Request(`https://scoaster.com/api/leaderboard?daily=${day}`)

function setup(failing = false, noDayColumn = false, rateTrigger = false) {
  let t = Date.UTC(2026, 10, 5, 12)
  const now = () => t
  const db = fakeDb(now, failing, noDayColumn, rateTrigger)
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

  it('ranks a run among 60 s runs only, past a long run from before the 60 s rules', async () => {
    const { db, deps } = setup()
    db.rows.push(longRun('level1', 0))
    const body = await (await postScore(post(run), deps)).json()
    expect(body.rank).toBe(1)
    expect(body.top.map((e: PublicEntry) => e.initials)).toEqual(['ABC'])
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

  it("holds parallel POSTs from one IP to the limit with the migration's trigger, though every count passed (#384)", async () => {
    // Each POST counts before any of the others inserts: the race the count alone loses.
    const raced = (db: ScoresDb): ScoresDb => ({ ...db, count: (f) => (f.ip_hash ? Promise.resolve(0) : db.count(f)) })
    const burst = async (db: ScoresDb, deps: Deps) =>
      (await Promise.all(Array.from({ length: 8 }, () => postScore(post(run), { ...deps, db: raced(db) })))).map((r) => r.status).sort()
    const before = setup()
    expect(await burst(before.db, before.deps)).toEqual(Array(8).fill(200))
    const after = setup(false, false, true)
    expect(await burst(after.db, after.deps)).toEqual([...Array(5).fill(200), ...Array(3).fill(429)])
    expect(after.db.rows).toHaveLength(5)
  })

  it("keeps the trigger's limit and error code in step with RATE_LIMIT", () => {
    const sql = fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/0005_rate_limit.sql'), 'utf8')
    expect(sql).toContain(`>= ${RATE_LIMIT.max} then`)
    expect(sql).toContain(`interval '${RATE_LIMIT.windowMs / 60000} minutes'`)
    expect(sql).toContain(`errcode = '${RATE_LIMITED}'`)
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
    expect(res.headers.get('cache-control')).toBe('public, s-maxage=30, stale-while-revalidate=30')
    const { top } = await res.json()
    expect(top).toHaveLength(10)
    expect(top[0]).toEqual({ initials: 'ABC', score: 1200, at: expect.any(String) })
  })

  it('leaves rows over the level\'s 60 s limit off the board (#458)', async () => {
    const { db, deps } = setup()
    db.rows.push(longRun('level5', 0), longRun('level5', 1))
    for (let i = 1; i <= 10; i++) await postScore(post({ ...run, level: 'level5', score: i * 100 }, `10.0.0.${i}`), deps)
    db.rows.push({ ...longRun('level5', 2), score: LEVEL_LIMITS.level5.maxScore, initials: 'TOP' })
    const { top } = await (await getBoard(get('level5'), deps)).json()
    expect(top).toHaveLength(10)
    expect(top.map((e: PublicEntry) => e.initials)).not.toContain('OLD')
    expect(top[0]).toMatchObject({ initials: 'TOP', score: LEVEL_LIMITS.level5.maxScore })
    expect(top[9].score).toBe(200)
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

describe('the Daily Run board (#854)', () => {
  const today = '2026-11-05'
  const daily = { ...run, level: dayLevel(today), daily: today }
  const scores = (top: PublicEntry[]) => top.map((e) => e.score)

  it("keeps daily and campaign rows apart: each board and rank counts its own", async () => {
    const { db, deps } = setup()
    await postScore(post({ ...run, level: daily.level, score: 5000 }, '7.7.7.7'), deps)
    const res = await postScore(post(daily), deps)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ rank: 1, top: [{ score: 2400 }] })
    expect(db.rows[1].day).toBe(today)
    expect(scores((await (await getBoard(getDaily(today), deps)).json()).top)).toEqual([2400])
    expect(scores((await (await getBoard(get(daily.level), deps)).json()).top)).toEqual([5000])
    expect(scores((await (await getBoard(getDaily('2026-11-04'), deps)).json()).top)).toEqual([])
  })

  it("takes yesterday's daily, not an older or a future one, and only on the day's level", async () => {
    const { db, deps } = setup()
    expect((await postScore(post({ ...daily, level: dayLevel('2026-11-04'), daily: '2026-11-04' }), deps)).status).toBe(200)
    const other = DAILY_LEVELS.find((l) => l !== daily.level)!
    for (const body of [
      { ...daily, level: dayLevel('2026-11-03'), daily: '2026-11-03' },
      { ...daily, level: dayLevel('2026-11-06'), daily: '2026-11-06' },
      { ...daily, level: other },
      { ...daily, daily: '2026-11-5' },
      { ...daily, daily: 20261105 },
    ]) expect((await postScore(post(body), deps)).status).toBe(400)
    expect(db.rows).toHaveLength(1)
  })

  it('400s a bad day on GET', async () => {
    for (const day of ['2026-13-01', 'today', '']) expect((await getBoard(getDaily(day), setup().deps)).status).toBe(400)
  })

  it('503s daily calls before the migration while the campaign board keeps working', async () => {
    const { db, deps } = setup(false, true)
    expect((await postScore(post(daily), deps)).status).toBe(503)
    expect((await getBoard(getDaily(today), deps)).status).toBe(503)
    expect((await postScore(post(run), deps)).status).toBe(200)
    expect((await getBoard(get('level1'), deps)).status).toBe(200)
    expect(db.rows.map((r) => r.day)).toEqual([undefined])
  })
})

describe('the Daily Run ghost (#1042)', () => {
  const today = '2026-11-05'
  const daily = { ...run, level: dayLevel(today), daily: today }
  /** `src/combat/ghost.ts`' format: `samples` samples aiming mid-view, the flag byte `flags`. */
  const ghostOf = (samples: number, flags = 0, stepMs = 50) => `1;${stepMs};${btoa(String.fromCharCode(0, 2, flags).repeat(samples))}`
  const getGhost = (day: string) => new Request(`https://scoaster.com/api/leaderboard?daily=${day}&ghost=1`)
  const ghostAt = async (deps: Deps, day = today) => {
    const res = await getBoard(getGhost(day), deps)
    return { status: res.status, cache: res.headers.get('Cache-Control'), ghost: (await res.json()).ghost }
  }

  it("stores a daily run's ghost and serves the day's best one, CDN-cached like the board", async () => {
    const { db, deps } = setup()
    expect(await ghostAt(deps)).toEqual({ status: 200, cache: expect.stringContaining('s-maxage=30'), ghost: null })
    const second = ghostOf(1200, 16)
    const best = ghostOf(2400)
    expect((await postScore(post({ ...daily, score: 2000, ghost: second }, '1.1.1.1'), deps)).status).toBe(200)
    expect((await postScore(post({ ...daily, score: 2400, ghost: best }, '2.2.2.2'), deps)).status).toBe(200)
    // The day's #1 without a ghost (a client from before #1042) leaves the best run that has one.
    expect((await postScore(post({ ...daily, score: 3000 }, '3.3.3.3'), deps)).status).toBe(200)
    expect(db.rows.map((r) => r.ghost)).toEqual([second, best, undefined])
    expect((await ghostAt(deps)).ghost).toBe(best)
    expect((await ghostAt(deps, '2026-11-04')).ghost).toBeNull()
  })

  it('drops an undecodable or oversize ghost and keeps the score', async () => {
    const { db, deps } = setup()
    const bad = [
      '2;50;AAIA', // another version
      '1;0;AAIA', // no step
      '1;60000;AAIA', // a step of a minute
      '1;050;AAIA', // not how the encoder writes it
      '1;50;AAI', // not whole samples
      '1;50;AAIA====',
      '1;50;AAIg', // a flag byte over 31
      '1;50;AA IA',
      ghostOf(2401), // past the cap
      `${ghostOf(10)};x`,
      12345,
      { x: 1 },
    ]
    for (const [i, ghost] of bad.entries()) {
      expect((await postScore(post({ ...daily, score: 1000 + i, ghost }, `9.9.9.${i}`), deps)).status).toBe(200)
    }
    expect(db.rows).toHaveLength(bad.length)
    expect(db.rows.every((r) => r.ghost === undefined)).toBe(true)
    expect(ghostOf(2400, 0, 59999).length).toBe(MAX_GHOST_CHARS)
  })

  it("refuses a body past 12 KB, and past 2 KB on a campaign run, whose ghost is never stored", async () => {
    const { db, deps } = setup()
    expect((await postScore(post({ ...daily, ghost: ghostOf(2400), pad: 'x'.repeat(3000) }), deps)).status).toBe(413)
    expect((await postScore(post({ ...run, ghost: ghostOf(2400) }), deps)).status).toBe(413)
    expect((await postScore(post({ ...run, ghost: ghostOf(10) }), deps)).status).toBe(200)
    expect(db.rows).toHaveLength(1)
    expect(db.rows[0].ghost).toBeUndefined()
    expect((await getBoard(new Request('https://scoaster.com/api/leaderboard?level=level1&ghost=1'), deps)).status).toBe(400)
  })

  it('before 0006 adds the column: daily scores still post and read, with no ghost stored or served', async () => {
    // The real scoresDb over a PostgREST that knows no `ghost` column (PGRST204 on a write naming it, 42703 on a read).
    const stored: Record<string, unknown>[] = []
    const missing = (code: string) => Response.json({ code }, { status: 400 })
    const fetchImpl = async (url: string, init: RequestInit) => {
      if (init.method === 'HEAD') return new Response(null, { headers: { 'Content-Range': `*/${stored.length}` } })
      if (init.method === 'POST') {
        const row = JSON.parse(String(init.body))
        if ('ghost' in row) return missing('PGRST204')
        stored.push(row)
        return new Response(null, { status: 201 })
      }
      if (url.includes('select=ghost')) return missing('42703')
      return Response.json(stored.map((r) => ({ initials: r.initials, score: r.score, created_at: '2026-11-05T12:00:00Z' })))
    }
    const db = scoresDb({ SUPABASE_URL: 'https://abc.supabase.co', SUPABASE_SECRET_KEY: 'k' }, fetchImpl)
    const deps: Deps = { db, salt: 'secret', now: () => Date.UTC(2026, 10, 5, 12) }
    const res = await postScore(post({ ...daily, ghost: ghostOf(100) }), deps)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ rank: 1, top: [{ initials: 'ABC', score: 2400 }] })
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ day: today, score: 2400 })
    expect(await ghostAt(deps)).toMatchObject({ status: 200, ghost: null })
    expect((await getBoard(getDaily(today), deps)).status).toBe(200)
  })
})
