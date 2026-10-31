import { describe, expect, it } from 'vitest'
import type { LeaderboardEntry } from '@/types/game'
import {
  LEADERBOARD_SIZE,
  insertEntry,
  normalizeInitials,
  placement,
  sanitizeLeaderboards,
  sanitizeSavedScores,
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

  it('anything that is not an object loads as empty', () => {
    for (const v of [null, undefined, 3, 'x', []]) {
      expect(sanitizeSavedScores(v)).toEqual({})
      expect(sanitizeLeaderboards(v, {})).toEqual({})
    }
  })
})
