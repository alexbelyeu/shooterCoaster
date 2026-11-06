/**
 * The online leaderboard (#365), a Vercel Function on the Node.js runtime.
 * GET  /api/leaderboard?level=<id> → { top: [{ initials, score, at }] } (CDN-cached 30 s)
 * POST /api/leaderboard { level, initials, score, seed, kills, accuracy, version } → { rank, top }
 * Setup and the table: docs/LEADERBOARD.md, supabase/migrations/.
 */
import { getBoard, postScore, type Deps } from './_lib/handler.js'
import { scoresDb } from './_lib/scoresDb.js'

const deps = (): Deps => ({ db: scoresDb(process.env), salt: process.env.SUPABASE_SECRET_KEY ?? '', now: Date.now })

export function GET(request: Request): Promise<Response> {
  return getBoard(request, deps())
}

export function POST(request: Request): Promise<Response> {
  return postScore(request, deps())
}
