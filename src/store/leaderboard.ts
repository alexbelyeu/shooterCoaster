/** The local top-10 per level and the guards on what comes back from localStorage (pure, unit-tested). */
import type { LeaderboardEntry, ScoreEntry } from '@/types/game'

export const LEADERBOARD_SIZE = 10
export const INITIALS_LENGTH = 3
export const INITIALS_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
export const DEFAULT_INITIALS = 'AAA'
/** Shown for a best score carried over from before the leaderboard existed. */
export const UNKNOWN_INITIALS = '---'

export type Leaderboards = Record<string, LeaderboardEntry[]>

/** Where `score` would land (0-based), or null when it misses the board. A tie ranks below the entries already there. */
export function placement(board: readonly LeaderboardEntry[], score: number): number | null {
  if (!(score > 0)) return null
  const rank = board.findIndex((e) => score > e.score)
  if (rank >= 0) return rank
  return board.length < LEADERBOARD_SIZE ? board.length : null
}

export function insertEntry(
  board: readonly LeaderboardEntry[],
  entry: LeaderboardEntry,
): { board: LeaderboardEntry[]; rank: number | null } {
  const rank = placement(board, entry.score)
  if (rank === null) return { board: [...board], rank }
  const next = [...board.slice(0, rank), entry, ...board.slice(rank)]
  return { board: next.slice(0, LEADERBOARD_SIZE), rank }
}

/** Upper-case A-Z only, padded with A to three letters. */
export function normalizeInitials(value: unknown): string {
  const letters = typeof value === 'string' ? value.toUpperCase().replace(/[^A-Z]/g, '') : ''
  return (letters + DEFAULT_INITIALS).slice(0, INITIALS_LENGTH)
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

const clampStars = (v: number) => Math.max(0, Math.min(3, Math.round(v)))

function sanitizeEntry(value: unknown): LeaderboardEntry | null {
  if (!isRecord(value) || !isFiniteNumber(value.score) || value.score <= 0) return null
  const initials = value.initials === UNKNOWN_INITIALS ? UNKNOWN_INITIALS : normalizeInitials(value.initials)
  return {
    initials,
    score: Math.round(value.score),
    stars: isFiniteNumber(value.stars) ? clampStars(value.stars) : 0,
    date: isFiniteNumber(value.date) ? value.date : 0,
  }
}

export function sanitizeSavedScores(value: unknown): Record<string, ScoreEntry> {
  const out: Record<string, ScoreEntry> = {}
  if (!isRecord(value)) return out
  for (const [level, raw] of Object.entries(value)) {
    if (!isRecord(raw) || !isFiniteNumber(raw.score) || !isFiniteNumber(raw.stars)) continue
    out[level] = {
      level,
      score: raw.score,
      maxScore: isFiniteNumber(raw.maxScore) ? raw.maxScore : 0,
      stars: clampStars(raw.stars),
      timestamp: isFiniteNumber(raw.timestamp) ? raw.timestamp : 0,
      ...(isFiniteNumber(raw.bestCombo) ? { bestCombo: raw.bestCombo } : {}),
    }
  }
  return out
}

/**
 * Every board sorted, capped and with valid entries only. A level with a saved best but no
 * board (scores from before the leaderboard) starts with that best under `---`.
 */
export function sanitizeLeaderboards(value: unknown, savedScores: Record<string, ScoreEntry>): Leaderboards {
  const out: Leaderboards = {}
  if (isRecord(value)) {
    for (const [level, raw] of Object.entries(value)) {
      if (!Array.isArray(raw)) continue
      const entries = raw.map(sanitizeEntry).filter((e): e is LeaderboardEntry => e !== null)
      entries.sort((a, b) => b.score - a.score)
      if (entries.length) out[level] = entries.slice(0, LEADERBOARD_SIZE)
    }
  }
  for (const [level, best] of Object.entries(savedScores)) {
    if (out[level] || !(best.score > 0)) continue
    out[level] = [{ initials: UNKNOWN_INITIALS, score: Math.round(best.score), stars: best.stars, date: best.timestamp }]
  }
  return out
}
