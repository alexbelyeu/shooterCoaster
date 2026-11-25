/**
 * The Daily Run's World best ghost (#1042): the day's top run that carries one, fetched once per run as it starts (a
 * pause remounts the crosshair, not the request), only where the World board is on (`onlineEndpoint`). Any failure, a
 * missing ghost or one that doesn't decode is no ghost.
 */
import { decodeGhost } from '@/combat/ghost'
import type { GhostTrack } from '@/combat/ghostTrack.hot'
import { onlineEndpoint, onlineLeaderboard } from './onlineLeaderboard'

let fetched: [runId: number, track: Promise<GhostTrack | null>] | undefined

/** Null where the World board is off. */
export function dailyGhost(day: string, runId: number): Promise<GhostTrack | null> | null {
  const endpoint = onlineEndpoint(__BUILT_ON_VERCEL__, window.location.search)
  if (!endpoint) return null
  if (fetched?.[0] !== runId) fetched = [runId, onlineLeaderboard(endpoint).ghost(day).then(decodeGhost)]
  return fetched[1]
}
