/**
 * The online top 10 (`api/leaderboard.ts`, #365) and the Daily Run's (#854): every call resolves to null on any failure,
 * and the results screen keeps the local board (or a daily's local record).
 */
import type { PublicEntry, Submission } from '../../api/_lib/rules'
import type { LeaderboardEntry } from '@/types/game'
import { computeStars } from '@/levels/scoring'
import { isLiveSite } from './analyticsGate'

export const ONLINE_ENDPOINT = '/api/leaderboard'
export const ONLINE_TIMEOUT_MS = 3000

export type OnlineEntry = PublicEntry

/**
 * The server's `Submission`, plus a daily run's UTC day (`dailyKey`): it goes on that day's board, not the level's,
 * with its ghost (`encodeGhost`, #1042).
 */
export type OnlineSubmission = Submission & { daily?: string; ghost?: string }

export interface SubmitResult {
  /** 0-based, like the local board's; null when the run missed the online top 10. */
  rank: number | null
  top: OnlineEntry[]
}

let endpointOverride: string | null | undefined

/** The smoke's stubbed API (`__SC_TEST__.onlineBoard`); undefined goes back to the build's own rule. */
export function setOnlineEndpointOverride(endpoint: string | null | undefined): void {
  endpointOverride = endpoint
}

/** Unlike analytics, an internal browser (`?internal=1`) still posts: the World board is the game, not tracking. */
export function onlineEndpoint(builtOnVercel: boolean, search: string): string | null {
  if (endpointOverride !== undefined) return endpointOverride
  return isLiveSite(builtOnVercel, search) ? ONLINE_ENDPOINT : null
}

/** `submitOnEntry`: once, on OK or as the screen closes with the initials entry still open. */
export type OnlinePlan = { kind: 'submitNow'; daily: string } | { kind: 'submitOnEntry' } | { kind: 'show'; board: { level: string } | { daily: string } }

export function onlinePlan(level: string, dailyKey: string | null, newBest: boolean, placedLocally: boolean): OnlinePlan {
  if (dailyKey !== null) return newBest ? { kind: 'submitNow', daily: dailyKey } : { kind: 'show', board: { daily: dailyKey } }
  return placedLocally ? { kind: 'submitOnEntry' } : { kind: 'show', board: { level } }
}

export function worldRows(top: readonly OnlineEntry[], maxScore: number, thresholds: readonly [number, number, number]): LeaderboardEntry[] {
  return top.map((e) => ({ initials: e.initials, score: e.score, stars: computeStars(e.score, maxScore, thresholds), date: Date.parse(e.at) || 0 }))
}

const isEntry = (v: unknown): v is OnlineEntry => {
  if (typeof v !== 'object' || v === null) return false
  const e = v as Record<string, unknown>
  return typeof e.initials === 'string' && /^[A-Z]{3}$/.test(e.initials) && Number.isSafeInteger(e.score) && (e.score as number) > 0 && typeof e.at === 'string'
}

export function parseTop(value: unknown): OnlineEntry[] | null {
  return Array.isArray(value) && value.every(isEntry) ? value.slice(0, 10) : null
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>

async function request(fetchImpl: Fetch, url: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), timeoutMs)
  try {
    const res = await fetchImpl(url, { ...init, signal: abort.signal })
    return res.ok ? await res.json() : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export function onlineLeaderboard(endpoint: string, fetchImpl: Fetch = (url, init) => fetch(url, init), timeoutMs = ONLINE_TIMEOUT_MS) {
  return {
    /** The campaign board of `board.level`, or the daily board of `board.daily`. */
    async top(board: { level: string } | { daily: string }): Promise<OnlineEntry[] | null> {
      const query = 'daily' in board ? `daily=${encodeURIComponent(board.daily)}` : `level=${encodeURIComponent(board.level)}`
      const body = await request(fetchImpl, `${endpoint}?${query}`, { method: 'GET' }, timeoutMs)
      return parseTop((body as { top?: unknown } | null)?.top)
    },
    /** The day's World best ghost (`encodeGhost`'s string, unchecked: `decodeGhost` it), or null. */
    async ghost(daily: string): Promise<string | null> {
      const body = await request(fetchImpl, `${endpoint}?daily=${encodeURIComponent(daily)}&ghost=1`, { method: 'GET' }, timeoutMs)
      const ghost = (body as { ghost?: unknown } | null)?.ghost
      return typeof ghost === 'string' ? ghost : null
    },
    async submit(run: OnlineSubmission): Promise<SubmitResult | null> {
      // keepalive: a reload as results closes (`app/staleReload.ts`) must not cancel it.
      const init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(run), keepalive: true }
      const body = (await request(fetchImpl, endpoint, init, timeoutMs)) as { rank?: unknown; top?: unknown } | null
      const top = parseTop(body?.top)
      if (!top) return null
      const rank = body?.rank
      return { rank: typeof rank === 'number' && Number.isInteger(rank) && rank >= 1 && rank <= top.length ? rank - 1 : null, top }
    },
  }
}

export function runAccuracy(hits: number, shotsFired: number): number {
  return shotsFired > 0 ? Math.min(1, Math.max(0, hits / shotsFired)) : 0
}
