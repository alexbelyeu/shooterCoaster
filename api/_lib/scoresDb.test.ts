import { describe, expect, it } from 'vitest'
import { DbError, scoresDb } from './scoresDb'

const env = { SUPABASE_URL: 'https://abc.supabase.co/', SUPABASE_SECRET_KEY: 'sb_secret_x' }

function recorder(respond: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = []
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return respond(url, init)
  }) as unknown as typeof fetch
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
    const top = await scoresDb(env, fetchImpl)!.top('level1')
    expect(top).toEqual([{ initials: 'ABC', score: 900, at: '2026-11-05T12:00:00Z' }])
    expect(calls[0].url).toBe('https://abc.supabase.co/rest/v1/scores?select=initials,score,created_at&level_id=eq.level1&order=score.desc,created_at.asc&limit=10')
    expect(calls[0].init.headers).toEqual({ apikey: 'sb_secret_x' })
  })

  it('counts from Content-Range', async () => {
    const { calls, fetchImpl } = recorder(() => new Response(null, { status: 200, headers: { 'Content-Range': '*/4' } }))
    expect(await scoresDb(env, fetchImpl)!.count({ ip_hash: 'eq.ff', created_at: 'gte.2026-11-05T12:00:00.000Z' })).toBe(4)
    expect(calls[0].init.method).toBe('HEAD')
    expect(calls[0].url).toBe('https://abc.supabase.co/rest/v1/scores?select=id&ip_hash=eq.ff&created_at=gte.2026-11-05T12%3A00%3A00.000Z')
  })

  it('inserts the row under the table\'s column names', async () => {
    const { calls, fetchImpl } = recorder(() => new Response(null, { status: 201 }))
    await scoresDb(env, fetchImpl)!.insert({ level: 'level2', initials: 'XYZ', score: 10, seed: 7, kills: 1, accuracy: 0.5, version: '2.0.0', ipHash: 'ab' })
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      level_id: 'level2', initials: 'XYZ', score: 10, run_seed: 7, kills: 1, accuracy: 0.5, client_version: '2.0.0', ip_hash: 'ab',
    })
  })

  it('throws DbError on an error status (a paused project) or no connection', async () => {
    const paused = recorder(() => new Response('paused', { status: 540 }))
    await expect(scoresDb(env, paused.fetchImpl)!.top('level1')).rejects.toBeInstanceOf(DbError)
    const down = recorder(() => {
      throw new TypeError('fetch failed')
    })
    await expect(scoresDb(env, down.fetchImpl)!.count({})).rejects.toBeInstanceOf(DbError)
  })
})
