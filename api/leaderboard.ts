/** The online leaderboard (#365); the API and its setup: docs/LEADERBOARD.md. */
import { getBoard, postScore, type Deps } from './_lib/handler.js'
import { scoresDb } from './_lib/scoresDb.js'

const deps = (): Deps => ({ db: scoresDb(process.env), salt: process.env.SUPABASE_SECRET_KEY ?? '', now: Date.now })

export function GET(request: Request): Promise<Response> {
  return getBoard(request, deps())
}

export function POST(request: Request): Promise<Response> {
  return postScore(request, deps())
}
