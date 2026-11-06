import { afterEach, describe, expect, it } from 'vitest'
import { onlineEndpoint, onlineLeaderboard, runAccuracy, setOnlineEndpointOverride } from './onlineLeaderboard'

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

  it('takes the smoke\'s override either way', () => {
    setOnlineEndpointOverride('/api/leaderboard')
    expect(onlineEndpoint(false, '?e2e=1')).toBe('/api/leaderboard')
    setOnlineEndpointOverride(null)
    expect(onlineEndpoint(true, '')).toBeNull()
  })
})

describe('onlineLeaderboard', () => {
  it('reads the top 10', async () => {
    expect(await onlineLeaderboard('/api', respond(200, { top })).top('level1')).toEqual(top)
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
      expect(await board.top('level1')).toBeNull()
      expect(await board.submit(run)).toBeNull()
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
