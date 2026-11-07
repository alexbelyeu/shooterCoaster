/** No env vars, a paused project or any database error answer a bare 503: never a 500, a stack trace or a secret. */
import { checkSubmission, clientIp, hashIp, isCampaignLevel, MAX_BODY_BYTES, rankFrom, rateLimited, windowStart } from './rules.js'
import type { ScoresDb } from './scoresDb.js'

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
  const read = await readJson(request, MAX_BODY_BYTES)
  if ('reject' in read) return read.reject
  const checked = checkSubmission(read.body)
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
