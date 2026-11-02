import { describe, expect, it } from 'vitest'
import { getAllLevels, getLevelConfig } from './LevelRegistry'
import type { ScoreEntry } from '@/types/game'
import {
  DAILY_KEEP_DAYS,
  DAILY_LEVELS,
  currentStreak,
  dailyKey,
  dailyLevel,
  dailySeed,
  extendStreak,
  pruneDaily,
} from './daily'

describe('daily run', () => {
  it('keys a date by its UTC day, whatever the time of day', () => {
    expect(dailyKey(new Date('2026-10-31T00:00:00Z'))).toBe('2026-10-31')
    expect(dailyKey(new Date('2026-10-31T23:59:59Z'))).toBe('2026-10-31')
    expect(dailyKey(new Date('2026-11-01T00:00:00Z'))).toBe('2026-11-01')
    // 23:30 in New York on Oct 31 is already Nov 1 in UTC.
    expect(dailyKey(new Date('2026-10-31T23:30:00-04:00'))).toBe('2026-11-01')
  })

  it('gives the same seed and level all day, from a Date or its key', () => {
    const morning = new Date('2026-10-31T01:00:00Z')
    const night = new Date('2026-10-31T22:00:00Z')
    expect(dailySeed(morning)).toBe(dailySeed(night))
    expect(dailySeed(morning)).toBe(dailySeed('2026-10-31'))
    expect(dailyLevel(morning)).toBe(dailyLevel(night))
    expect(dailyLevel(morning)).toBe(dailyLevel('2026-10-31'))
  })

  it('changes the seed every day and rotates through the first three levels', () => {
    const keys = Array.from({ length: 30 }, (_, i) => dailyKey(new Date(Date.UTC(2026, 9, 20 + i))))
    expect(new Set(keys.map(dailySeed)).size).toBe(keys.length)
    const levels = keys.map(dailyLevel)
    for (let i = 1; i < levels.length; i++) expect(levels[i]).not.toBe(levels[i - 1])
    expect(new Set(levels)).toEqual(new Set(DAILY_LEVELS))
  })

  it('only picks levels that exist and open the campaign', () => {
    const first = getAllLevels().slice(0, DAILY_LEVELS.length).map((l) => l.id)
    expect([...DAILY_LEVELS]).toEqual(first)
    for (const id of DAILY_LEVELS) expect(getLevelConfig(id)).toBeDefined()
  })
})

describe('daily streak', () => {
  it('extends on the next day, holds on the same day and restarts after a gap', () => {
    let s = extendStreak({ count: 0, lastKey: null }, '2026-10-30')
    expect(s).toEqual({ count: 1, lastKey: '2026-10-30' })
    expect(extendStreak(s, '2026-10-30')).toBe(s)
    s = extendStreak(s, '2026-10-31')
    s = extendStreak(s, '2026-11-01')
    expect(s).toEqual({ count: 3, lastKey: '2026-11-01' })
    expect(extendStreak(s, '2026-11-03')).toEqual({ count: 1, lastKey: '2026-11-03' })
  })

  it('reads as alive until a full day is missed', () => {
    const s = { count: 4, lastKey: '2026-10-30' }
    expect(currentStreak(s, '2026-10-30')).toBe(4)
    expect(currentStreak(s, '2026-10-31')).toBe(4)
    expect(currentStreak(s, '2026-11-01')).toBe(0)
    expect(currentStreak({ count: 0, lastKey: null }, '2026-10-31')).toBe(0)
  })
})

describe('pruneDaily', () => {
  it(`keeps only the last ${DAILY_KEEP_DAYS} days`, () => {
    const e = (level: string): ScoreEntry => ({ level, score: 1, maxScore: 1, stars: 0, timestamp: 0 })
    const saved = { '2026-10-31': e('level1'), '2026-10-02': e('level2'), '2026-10-01': e('level3') }
    expect(Object.keys(pruneDaily(saved, '2026-10-31')).sort()).toEqual(['2026-10-02', '2026-10-31'])
  })
})
