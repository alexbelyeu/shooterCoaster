import { describe, expect, it } from 'vitest'
import { DbError, scoresDb } from './scoresDb'

const env = { SUPABASE_URL: 'https://abc.supabase.co/', SUPABASE_SECRET_KEY: 'sb_secret_x' }

function recorder(respond: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = []
  const fetchImpl = async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return respond(url, init)
  }
  return { calls, fetchImpl }
}

describe('scoresDb', () => {
  it('is null without both env vars', () => {
    expect(scoresDb({})).toBeNull()
    expect(scoresDb({ SUPABASE_URL: env.SUPABASE_URL })).toBeNull()
    expect(scoresDb({ SUPABASE_SECRET_KEY: env.SUPABASE_SECRET_KEY, SUPABASE_URL: ' ' })).toBeNull()
  })

  it('reads the top 10 with the secret key in apikey only', async () => {
    const { calls, fetchImpl } = recorder(() => Response.json([{ initials: 'ABC', score: 900, created_at: '2026-11-05T12:00:00Z' }]))
    const top = await scoresDb(env, fetchImpl)!.top('level1', 14350, null)
    expect(top).toEqual([{ initials: 'ABC', score: 900, at: '2026-11-05T12:00:00Z' }])
    expect(calls[0].url).toBe('https://abc.supabase.co/rest/v1/scores?select=initials,score,created_at&level_id=eq.level1&score=lte.14350&day=is.null&order=score.desc,created_at.asc&limit=10')
    expect(calls[0].init.headers).toEqual({ apikey: 'sb_secret_x' })
    await scoresDb(env, fetchImpl)!.top('level2', 12250, '2026-11-05')
    expect(calls[1].url).toContain('&level_id=eq.level2&score=lte.12250&day=eq.2026-11-05&')
  })

  it('before the day column exists (#854): retries the campaign board without it, fails a daily call', async () => {
    const missing = () => Response.json({ code: '42703', message: 'column scores.day does not exist' }, { status: 400 })
    const { calls, fetchImpl } = recorder((url) => (url.includes('day=') ? missing() : Response.json([])))
    const db = scoresDb(env, fetchImpl)!
    expect(await db.top('level1', 14350, null)).toEqual([])
    expect(calls[1].url).not.toContain('day=')
    await expect(db.top('level1', 14350, '2026-11-05')).rejects.toMatchObject({ code: '42703' })
    const counted = recorder((url) => (url.includes('day=') ? missing() : new Response(null, { headers: { 'Content-Range': '*/2' } })))
    expect(await scoresDb(env, counted.fetchImpl)!.count({ level_id: 'eq.level1', day: 'is.null' })).toBe(2)
    await expect(scoresDb(env, counted.fetchImpl)!.count({ day: 'eq.2026-11-05' })).rejects.toBeInstanceOf(DbError)
  })

  it('counts from Content-Range', async () => {
    const { calls, fetchImpl } = recorder(() => new Response(null, { status: 200, headers: { 'Content-Range': '*/4' } }))
    expect(await scoresDb(env, fetchImpl)!.count({ ip_hash: 'eq.ff', created_at: 'gte.2026-11-05T12:00:00.000Z' })).toBe(4)
    expect(calls[0].init.method).toBe('HEAD')
    expect(calls[0].url).toBe('https://abc.supabase.co/rest/v1/scores?select=id&ip_hash=eq.ff&created_at=gte.2026-11-05T12%3A00%3A00.000Z')
    await scoresDb(env, fetchImpl)!.count({ score: 'gte.900', and: '(score.lte.14350)' })
    expect(calls[1].url).toBe('https://abc.supabase.co/rest/v1/scores?select=id&score=gte.900&and=(score.lte.14350)')
  })

  it('inserts the row under the table\'s column names', async () => {
    const { calls, fetchImpl } = recorder(() => new Response(null, { status: 201 }))
    await scoresDb(env, fetchImpl)!.insert({ level: 'level2', initials: 'XYZ', score: 10, seed: 7, kills: 1, accuracy: 0.5, version: '2.0.0', ipHash: 'ab' })
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      level_id: 'level2', initials: 'XYZ', score: 10, run_seed: 7, kills: 1, accuracy: 0.5, client_version: '2.0.0', ip_hash: 'ab',
    })
    await scoresDb(env, fetchImpl)!.insert({ level: 'level2', initials: 'XYZ', score: 10, seed: 7, kills: 1, accuracy: 0.5, version: '2.0.0', ipHash: 'ab', day: '2026-11-05' })
    expect(JSON.parse(calls[1].init.body as string).day).toBe('2026-11-05')
  })

  it("stores a daily's ghost and reads the day's best one (#1042); before 0006, drops it on write and reads none", async () => {
    const run = { level: 'level2', initials: 'XYZ', score: 10, seed: 7, kills: 1, accuracy: 0.5, version: '2.0.0', ipHash: 'ab', day: '2026-11-05', ghost: '1;50;AAIA' }
    const { calls, fetchImpl } = recorder((url, init) => (init.method === 'POST' ? new Response(null, { status: 201 }) : Response.json([{ ghost: '1;50;AAIA' }])))
    const db = scoresDb(env, fetchImpl)!
    await db.insert(run)
    expect(JSON.parse(calls[0].init.body as string).ghost).toBe('1;50;AAIA')
    expect(await db.ghost('level2', 12250, '2026-11-05')).toBe('1;50;AAIA')
    expect(calls[1].url).toBe('https://abc.supabase.co/rest/v1/scores?select=ghost&level_id=eq.level2&score=lte.12250&day=eq.2026-11-05&ghost=not.is.null&order=score.desc,created_at.asc&limit=1')

    const before = recorder((url, init) => {
      if (init.method === 'POST') return String(init.body).includes('"ghost"') ? Response.json({ code: 'PGRST204' }, { status: 400 }) : new Response(null, { status: 201 })
      return Response.json({ code: '42703' }, { status: 400 })
    })
    const old = scoresDb(env, before.fetchImpl)!
    await old.insert(run)
    expect(before.calls).toHaveLength(2)
    expect(JSON.parse(before.calls[1].init.body as string)).not.toHaveProperty('ghost')
    expect(await old.ghost('level2', 12250, '2026-11-05')).toBeNull()
  })

  it('throws DbError on an error status (a paused project) or no connection', async () => {
    const paused = recorder(() => new Response('paused', { status: 540 }))
    await expect(scoresDb(env, paused.fetchImpl)!.top('level1', 1, null)).rejects.toBeInstanceOf(DbError)
    const down = recorder(() => {
      throw new TypeError('fetch failed')
    })
    await expect(scoresDb(env, down.fetchImpl)!.count({})).rejects.toBeInstanceOf(DbError)
  })
})
