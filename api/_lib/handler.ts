/**
 * GET / POST /api/leaderboard (`api/leaderboard.ts`), with the database passed in so the unit
 * tests run it against a fake. No env vars, a paused project or any database error answer a
 * bare 503: never a 500, a stack trace or a secret.
 */
import { checkSubmission, clientIp, hashIp, isCampaignLevel, MAX_BODY_BYTES, rankFrom, rateLimited, windowStart } from './rules.js'
import type { ScoresDb } from './scoresDb.js'

export interface Deps {
  /** Null when the env vars aren't set. */
  db: ScoresDb | null
  /** Keys the IP hash; the server secret, so the hashes can't be reversed by brute force over IPs. */
  salt: string
  now: () => number
}

/** CDN-cached for 30 s: most reads never reach the function. */
const BOARD_CACHE = 'public, s-maxage=30, stale-while-revalidate=300'

function json(status: number, body: unknown, cache = 'no-store'): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': cache } })
}

const unavailable = () => json(503, { error: 'unavailable' })

export async function getBoard(request: Request, { db }: Deps): Promise<Response> {
  const level = new URL(request.url).searchParams.get('level')
  if (!isCampaignLevel(level)) return json(400, { error: 'unknown level' })
  if (!db) return unavailable()
  try {
    return json(200, { top: await db.top(level) }, BOARD_CACHE)
  } catch {
    return unavailable()
  }
}

export async function postScore(request: Request, { db, salt, now }: Deps): Promise<Response> {
  if (!db) return unavailable()
  let text: string
  try {
    text = await request.text()
  } catch {
    return json(400, { error: 'bad body' })
  }
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return json(413, { error: 'too large' })
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return json(400, { error: 'bad json' })
  }
  const checked = checkSubmission(body)
  if (!checked.ok) return json(400, { error: checked.error })
  const run = checked.value
  try {
    const ipHash = await hashIp(clientIp(request.headers), salt)
    const recent = await db.count({ ip_hash: `eq.${ipHash}`, created_at: `gte.${windowStart(now())}` })
    if (rateLimited(recent)) return json(429, { error: 'too many submissions' })
    await db.insert({ ...run, ipHash })
    const atOrAbove = await db.count({ level_id: `eq.${run.level}`, score: `gte.${run.score}` })
    return json(200, { rank: rankFrom(atOrAbove), top: await db.top(run.level) })
  } catch {
    return unavailable()
  }
}
