/** `/api/telemetry` (#373). Like the leaderboard: no env vars or any database error answer a bare 503. */
import { json, readJson, unavailable } from './handler.js'
import { clientIp, hashIp } from './rules.js'
import type { TelemetryDb } from './telemetryDb.js'
import {
  checkReport,
  dailySalt,
  MAX_TELEMETRY_BYTES,
  RETENTION_DAYS,
  SUMMARY_ROW_LIMIT,
  SUMMARY_WINDOW_MS,
  summarize,
  TELEMETRY_RATE_LIMIT,
} from './telemetryRules.js'

export interface TelemetryDeps {
  db: TelemetryDb | null
  /** The server secret: keys the IP hashes. */
  salt: string
  now: () => number
  /** One POST in `PRUNE_ONE_IN` deletes the rows past retention. */
  random: () => number
}

const SUMMARY_CACHE = 'public, s-maxage=300, stale-while-revalidate=600'
const PRUNE_ONE_IN = 50
const DAY_MS = 24 * 3600 * 1000

/** The last 24 hours, aggregated: what `scripts/playerTelemetry.cjs` reads for the status page and the watchdog. No row is ever returned as stored. */
export async function getSummary(_request: Request, { db, now }: TelemetryDeps): Promise<Response> {
  if (!db) return unavailable()
  try {
    const t = now()
    const rows = await db.recent(new Date(t - SUMMARY_WINDOW_MS).toISOString(), SUMMARY_ROW_LIMIT)
    return json(200, summarize(rows, t, rows.length >= SUMMARY_ROW_LIMIT), SUMMARY_CACHE)
  } catch {
    return unavailable()
  }
}

/** A page load's beacon. `sendBeacon` ignores the answer; the status codes are for tests and curl. */
export async function postReport(request: Request, { db, salt, now, random }: TelemetryDeps): Promise<Response> {
  if (!db) return unavailable()
  const read = await readJson(request, MAX_TELEMETRY_BYTES)
  if ('reject' in read) return read.reject
  const checked = checkReport(read.body)
  if (!checked.ok) return json(400, { error: checked.error })
  try {
    const t = now()
    const ipHash = await hashIp(clientIp(request.headers), dailySalt(salt, t))
    const recent = await db.count({ ip_hash: `eq.${ipHash}`, created_at: `gte.${new Date(t - TELEMETRY_RATE_LIMIT.windowMs).toISOString()}` })
    if (recent >= TELEMETRY_RATE_LIMIT.max) return json(429, { error: 'too many reports' })
    await db.insert({ ...checked.value, ipHash })
    if (random() * PRUNE_ONE_IN < 1) await db.deleteBefore(new Date(t - RETENTION_DAYS * DAY_MS).toISOString()).catch(() => {})
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return unavailable()
  }
}
