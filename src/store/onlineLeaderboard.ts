/**
 * The online top 10 (`api/leaderboard.ts`, #365) from the game's side. Every call resolves, never
 * throws: no answer within the timeout, an error status (no env vars, a paused project) or a
 * malformed body all give null, and the results screen keeps the local board.
 */

export const ONLINE_ENDPOINT = '/api/leaderboard'
export const ONLINE_TIMEOUT_MS = 3000

export interface OnlineEntry {
  initials: string
  score: number
  /** ISO time the score was saved. */
  at: string
}

export interface OnlineSubmission {
  level: string
  initials: string
  score: number
  seed: number
  kills: number
  accuracy: number
  version: string
}

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

/** Only scoaster.com's own build talks to the API: never dev, preview, CI, the portal build or `?e2e=1` (unless the smoke stubs it). */
export function onlineEndpoint(builtOnVercel: boolean, search: string): string | null {
  if (endpointOverride !== undefined) return endpointOverride
  return builtOnVercel && !new URLSearchParams(search).has('e2e') ? ONLINE_ENDPOINT : null
}

const isEntry = (v: unknown): v is OnlineEntry => {
  if (typeof v !== 'object' || v === null) return false
  const e = v as Record<string, unknown>
  return typeof e.initials === 'string' && /^[A-Z]{3}$/.test(e.initials) && Number.isSafeInteger(e.score) && (e.score as number) > 0 && typeof e.at === 'string'
}

export function parseTop(value: unknown): OnlineEntry[] | null {
  return Array.isArray(value) && value.every(isEntry) ? value.slice(0, 10) : null
}

async function request(fetchImpl: typeof fetch, url: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
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

export function onlineLeaderboard(endpoint: string, fetchImpl: typeof fetch = fetch, timeoutMs = ONLINE_TIMEOUT_MS) {
  return {
    async top(level: string): Promise<OnlineEntry[] | null> {
      const body = await request(fetchImpl, `${endpoint}?level=${encodeURIComponent(level)}`, { method: 'GET' }, timeoutMs)
      return parseTop((body as { top?: unknown } | null)?.top)
    },
    async submit(run: OnlineSubmission): Promise<SubmitResult | null> {
      const init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(run) }
      const body = (await request(fetchImpl, endpoint, init, timeoutMs)) as { rank?: unknown; top?: unknown } | null
      const top = parseTop(body?.top)
      if (!top) return null
      const rank = Number.isSafeInteger(body?.rank) && (body!.rank as number) >= 1 && (body!.rank as number) <= top.length ? (body!.rank as number) - 1 : null
      return { rank, top }
    },
  }
}

/** Hits per bullet fired, 0..1, as the API takes it. */
export function runAccuracy(hits: number, shotsFired: number): number {
  return shotsFired > 0 ? Math.min(1, Math.max(0, hits / shotsFired)) : 0
}
