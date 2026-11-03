import { describe, expect, it } from 'vitest'
import type { LeaderboardEntry } from '@/types/game'
import {
  LEADERBOARD_SIZE,
  insertEntry,
  normalizeInitials,
  placement,
  sanitizeLeaderboards,
  sanitizeSavedDaily,
  sanitizeSavedScores,
  sanitizeStreak,
} from './leaderboard'

const row = (score: number, initials = 'AAA', date = score): LeaderboardEntry => ({ initials, score, stars: 1, date })
const full = () => Array.from({ length: LEADERBOARD_SIZE }, (_, i) => row(1000 - i * 100))

describe('placement', () => {
  it('ranks by score, a tie below the entries already there', () => {
    const board = [row(900), row(500), row(500), row(100)]
    expect(placement(board, 950)).toBe(0)
    expect(placement(board, 500)).toBe(3)
    expect(placement(board, 50)).toBe(4)
    expect(placement([], 1)).toBe(0)
  })

  it('misses a full board below its last entry, and never places 0 or NaN', () => {
    expect(placement(full(), 100)).toBeNull()
    expect(placement(full(), 101)).toBe(9)
    expect(placement([], 0)).toBeNull()
    expect(placement([], Number.NaN)).toBeNull()
  })
})

describe('insertEntry', () => {
  it('inserts at the rank and keeps ten', () => {
    const { board, rank } = insertEntry(full(), row(550, 'NEW'))
    expect(rank).toBe(5)
    expect(board).toHaveLength(LEADERBOARD_SIZE)
    expect(board[5].initials).toBe('NEW')
    expect(board[LEADERBOARD_SIZE - 1].score).toBe(200)
  })

  it('returns an unchanged copy when the run misses', () => {
    const before = full()
    const { board, rank } = insertEntry(before, row(10))
    expect(rank).toBeNull()
    expect(board).toEqual(before)
  })
})

describe('normalizeInitials', () => {
  it('keeps A-Z, upper-cased, padded to three', () => {
    expect(normalizeInitials('bob')).toBe('BOB')
    expect(normalizeInitials('j-k!lmn')).toBe('JKL')
    expect(normalizeInitials('Z')).toBe('ZAA')
    expect(normalizeInitials(42)).toBe('AAA')
  })
})

describe('sanitize', () => {
  it('drops invalid entries, sorts and caps each board', () => {
    const raw = {
      level1: [row(100), { score: 'x' }, null, row(900, 'b0b'), ...full()],
      level2: 'nope',
      level3: [{ score: -5, initials: 'AAA' }],
    }
    const boards = sanitizeLeaderboards(raw, {})
    expect(Object.keys(boards)).toEqual(['level1'])
    expect(boards.level1).toHaveLength(LEADERBOARD_SIZE)
    expect(boards.level1[0].score).toBe(1000)
    expect(boards.level1.find((e) => e.score === 900)?.initials).toBe('BBA')
  })

  it('carries an old best onto an empty board, never over a real one', () => {
    const saved = sanitizeSavedScores({
      level1: { level: 'level1', score: 700, maxScore: 1, stars: 2, timestamp: 5 },
      level2: { level: 'level2', score: 300, maxScore: 1, stars: 1, timestamp: 6 },
      level3: { score: 'bad' },
    })
    expect(Object.keys(saved)).toEqual(['level1', 'level2'])
    const boards = sanitizeLeaderboards({ level2: [row(400, 'ZZZ')] }, saved)
    expect(boards.level1).toEqual([{ initials: '---', score: 700, stars: 2, date: 5 }])
    expect(boards.level2).toEqual([row(400, 'ZZZ')])
  })

  it('clamps corrupt saved stars to 0–3, also in the row it seeds', () => {
    const saved = sanitizeSavedScores({
      level1: { score: 500, stars: -1 },
      level2: { score: 500, stars: 9.6 },
    })
    expect(saved.level1.stars).toBe(0)
    expect(saved.level2.stars).toBe(3)
    const boards = sanitizeLeaderboards(undefined, saved)
    expect(boards.level1[0].stars).toBe(0)
    expect(boards.level2[0].stars).toBe(3)
  })

  it('anything that is not an object loads as empty', () => {
    for (const v of [null, undefined, 3, 'x', []]) {
      expect(sanitizeSavedScores(v)).toEqual({})
      expect(sanitizeLeaderboards(v, {})).toEqual({})
      expect(sanitizeSavedDaily(v)).toEqual({})
      expect(sanitizeStreak(v)).toEqual({ count: 0, lastKey: null })
    }
  })
})

describe('daily record sanitisers', () => {
  it('keeps day-keyed bests with their own level, drops other keys and bad entries', () => {
    const daily = sanitizeSavedDaily({
      '2026-10-31': { level: 'level2', score: 400, maxScore: 1, stars: 7, timestamp: 3 },
      '2026-11-01': { score: 200, stars: 1 },
      level1: { level: 'level1', score: 1, stars: 1 },
      '2026-11-02': { score: 'x', stars: 1 },
    })
    expect(Object.keys(daily)).toEqual(['2026-10-31', '2026-11-01'])
    expect(daily['2026-10-31']).toEqual({ level: 'level2', score: 400, maxScore: 1, stars: 3, timestamp: 3 })
    expect(daily['2026-11-01'].level).toBe('')
  })

  it('a streak needs a count and a day key', () => {
    expect(sanitizeStreak({ count: 4, lastKey: '2026-11-01' })).toEqual({ count: 4, lastKey: '2026-11-01' })
    expect(sanitizeStreak({ count: -2.4, lastKey: '2026-11-01' })).toEqual({ count: 0, lastKey: '2026-11-01' })
    expect(sanitizeStreak({ count: 4, lastKey: null })).toEqual({ count: 0, lastKey: null })
    expect(sanitizeStreak({ count: 4, lastKey: 'yesterday' })).toEqual({ count: 0, lastKey: null })
  })
})
