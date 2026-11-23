/** No env vars, a paused project or any database error answer a bare 503: never a 500, a stack trace or a secret. */
import { boardCeiling, checkSubmission, clientIp, hashIp, isCampaignLevel, MAX_BODY_BYTES, rankFrom, rateLimited, windowStart } from './rules.js'
import { dailyError, dayLevel, isDayKey } from './daily.js'
import { CAMPAIGN, type ScoresDb } from './scoresDb.js'

export interface Deps {
  db: ScoresDb | null
  /** The server secret, so the IP hashes can't be reversed by brute force over the IPv4 space. */
  salt: string
  now: () => number
}

const BOARD_CACHE = 'public, s-maxage=30, stale-while-revalidate=300'

export function json(status: number, body: unknown, cache = 'no-store'): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': cache } })
}

export const unavailable = () => json(503, { error: 'unavailable' })

/** The parsed JSON body, or the 400 / 413 answer to send instead. */
export async function readJson(request: Request, maxBytes: number): Promise<{ body: unknown } | { reject: Response }> {
  let text: string
  try {
    text = await request.text()
  } catch {
    return { reject: json(400, { error: 'bad body' }) }
  }
  if (new TextEncoder().encode(text).length > maxBytes) return { reject: json(413, { error: 'too large' }) }
  try {
    return { body: JSON.parse(text) }
  } catch {
    return { reject: json(400, { error: 'bad json' }) }
  }
}

/** `?level=<id>`, the campaign's top 10, or `?daily=<YYYY-MM-DD>`, that day's daily (its level is the day's). */
export async function getBoard(request: Request, { db }: Deps): Promise<Response> {
  const params = new URL(request.url).searchParams
  const day = params.get('daily')
  if (day !== null && !isDayKey(day)) return json(400, { error: 'bad daily' })
  const level = day !== null ? dayLevel(day) : params.get('level')
  if (!isCampaignLevel(level)) return json(400, { error: 'unknown level' })
  if (!db) return unavailable()
  try {
    return json(200, { top: await db.top(level, boardCeiling(level), day) }, BOARD_CACHE)
  } catch {
    return unavailable()
  }
}

/** A run with `daily: '<YYYY-MM-DD>'` goes on that day's daily board, only today's or yesterday's (`dailyError`). */
export async function postScore(request: Request, { db, salt, now }: Deps): Promise<Response> {
  if (!db) return unavailable()
  const read = await readJson(request, MAX_BODY_BYTES)
  if ('reject' in read) return read.reject
  const checked = checkSubmission(read.body)
  if (!checked.ok) return json(400, { error: checked.error })
  const run = checked.value
  const { daily } = read.body as { daily?: unknown }
  if (daily !== undefined) {
    const error = dailyError(daily, run.level, now())
    if (error) return json(400, { error })
  }
  const day = typeof daily === 'string' ? daily : null
  try {
    const ipHash = await hashIp(clientIp(request.headers), salt)
    const recent = await db.count({ ip_hash: `eq.${ipHash}`, created_at: `gte.${windowStart(now())}` })
    if (rateLimited(recent)) return json(429, { error: 'too many submissions' })
    await db.insert(day ? { ...run, ipHash, day } : { ...run, ipHash })
    const ceiling = boardCeiling(run.level)
    const atOrAbove = await db.count({
      level_id: `eq.${run.level}`,
      day: day ? `eq.${day}` : CAMPAIGN,
      score: `gte.${run.score}`,
      and: `(score.lte.${ceiling})`,
    })
    return json(200, { rank: rankFrom(atOrAbove), top: await db.top(run.level, ceiling, day) })
  } catch {
    return unavailable()
  }
}
