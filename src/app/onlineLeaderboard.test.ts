import { afterEach, describe, expect, it } from 'vitest'
import { onlineEndpoint, onlineLeaderboard, onlinePlan, runAccuracy, setOnlineEndpointOverride, worldRows } from './onlineLeaderboard'

const top = [
  { initials: 'ABC', score: 900, at: '2026-11-05T12:00:00Z' },
  { initials: 'XYZ', score: 800, at: '2026-11-05T12:01:00Z' },
]
const run = { level: 'level1', initials: 'ABC', score: 900, seed: 1, kills: 50, accuracy: 0.5, version: '2.0.0' }

type Fetch = (url: string, init: RequestInit) => Promise<Response>
const respond = (status: number, body: unknown): Fetch => async () => new Response(JSON.stringify(body), { status })

describe('onlineEndpoint', () => {
  afterEach(() => setOnlineEndpointOverride(undefined))

  it('is on only for the Vercel build without ?e2e', () => {
    expect(onlineEndpoint(true, '')).toBe('/api/leaderboard')
    expect(onlineEndpoint(true, '?e2e=1')).toBeNull()
    expect(onlineEndpoint(false, '')).toBeNull()
  })

  it('still posts from an internal browser: the board is the game, not tracking', () => {
    expect(onlineEndpoint(true, '?internal=1')).toBe('/api/leaderboard')
  })

  it('takes the smoke\'s override either way', () => {
    setOnlineEndpointOverride('/api/leaderboard')
    expect(onlineEndpoint(false, '?e2e=1')).toBe('/api/leaderboard')
    setOnlineEndpointOverride(null)
    expect(onlineEndpoint(true, '')).toBeNull()
  })
})

describe('onlinePlan', () => {
  it('sends a campaign run that placed locally once its entry closes, and shows the board to one that missed', () => {
    expect(onlinePlan('level2', null, true, true)).toEqual({ kind: 'submitOnEntry' })
    expect(onlinePlan('level2', null, false, true)).toEqual({ kind: 'submitOnEntry' })
    expect(onlinePlan('level2', null, true, false)).toEqual({ kind: 'show', board: { level: 'level2' } })
  })

  it("sends a daily's new best of the day at once and shows the day's board otherwise, whatever the local board says", () => {
    expect(onlinePlan('level3', '2026-11-23', true, false)).toEqual({ kind: 'submitNow', daily: '2026-11-23' })
    expect(onlinePlan('level3', '2026-11-23', false, true)).toEqual({ kind: 'show', board: { daily: '2026-11-23' } })
  })
})

describe('worldRows', () => {
  it("rates each row with the level's stars and keeps a bad date as 0", () => {
    const rows = worldRows([...top, { initials: 'BAD', score: 100, at: 'nope' }], 1000, [0.3, 0.6, 0.9])
    expect(rows.map((r) => [r.initials, r.score, r.stars])).toEqual([
      ['ABC', 900, 3],
      ['XYZ', 800, 2],
      ['BAD', 100, 0],
    ])
    expect(rows[0].date).toBe(Date.parse(top[0].at))
    expect(rows[2].date).toBe(0)
  })
})

describe('onlineLeaderboard', () => {
  it("reads a level's top 10 or a day's daily board", async () => {
    const urls: string[] = []
    const fetchImpl: Fetch = async (url) => {
      urls.push(url)
      return new Response(JSON.stringify({ top }), { status: 200 })
    }
    expect(await onlineLeaderboard('/api', fetchImpl).top({ level: 'level1' })).toEqual(top)
    expect(await onlineLeaderboard('/api', fetchImpl).top({ daily: '2026-11-23' })).toEqual(top)
    expect(urls).toEqual(['/api?level=level1', '/api?daily=2026-11-23'])
  })

  it("reads the day's World best ghost (#1042), null when there is none", async () => {
    const urls: string[] = []
    const fetchImpl: Fetch = async (url) => {
      urls.push(url)
      return new Response(JSON.stringify({ ghost: '1;50;AAIA' }), { status: 200 })
    }
    expect(await onlineLeaderboard('/api', fetchImpl).ghost('2026-11-23')).toBe('1;50;AAIA')
    expect(urls).toEqual(['/api?daily=2026-11-23&ghost=1'])
    expect(await onlineLeaderboard('/api', respond(200, { ghost: null })).ghost('2026-11-23')).toBeNull()
    expect(await onlineLeaderboard('/api', respond(200, { ghost: 7 })).ghost('2026-11-23')).toBeNull()
  })

  it('submits and turns the 1-based rank into the board index', async () => {
    let sent: RequestInit | undefined
    const fetchImpl: Fetch = async (_url, init) => {
      sent = init
      return new Response(JSON.stringify({ rank: 2, top }), { status: 200 })
    }
    expect(await onlineLeaderboard('/api', fetchImpl).submit(run)).toEqual({ rank: 1, top })
    expect(JSON.parse(sent!.body as string)).toEqual(run)
    expect(await onlineLeaderboard('/api', respond(200, { rank: null, top })).submit(run)).toEqual({ rank: null, top })
  })

  it('falls back (null) on 503, 429, junk, a network error or a timeout', async () => {
    const boards = [
      onlineLeaderboard('/api', respond(503, { error: 'unavailable' })),
      onlineLeaderboard('/api', respond(429, { error: 'too many submissions' })),
      onlineLeaderboard('/api', respond(200, { top: [{ initials: '<b>', score: 1, at: 'x' }] })),
      onlineLeaderboard('/api', async () => new Response('<html>', { status: 200 })),
      onlineLeaderboard('/api', async () => {
        throw new TypeError('offline')
      }),
      onlineLeaderboard('/api', (_url, init) => new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))), 20),
    ]
    for (const board of boards) {
      expect(await board.top({ level: 'level1' })).toBeNull()
      expect(await board.submit(run)).toBeNull()
      expect(await board.ghost('2026-11-23')).toBeNull()
    }
  })
})

describe('runAccuracy', () => {
  it('is hits per shot in 0..1', () => {
    expect(runAccuracy(0, 0)).toBe(0)
    expect(runAccuracy(3, 4)).toBe(0.75)
    expect(runAccuracy(5, 4)).toBe(1)
  })
})
