import { describe, expect, it } from 'vitest'
import { getAllLevels, getLevelConfig, previousLevel } from '@/levels/LevelRegistry'
import type { ScoreEntry } from '@/types/game'
import { dailyLevel } from '@/levels/daily'
import {
  buildDailyCard,
  buildLevelCards,
  navigateCards,
  nextLevelIndex,
  totalStars,
  type CardRect,
  type LevelSelectSource,
} from './levelSelectModel'

const levels: LevelSelectSource[] = [
  { id: 'a', name: 'Alpha', description: '', biome: 'themePark', nextLevel: 'b' },
  { id: 'b', name: 'Bravo', description: '', biome: 'arctic', nextLevel: 'c' },
  { id: 'c', name: 'Charlie', description: '', biome: 'ocean', nextLevel: null },
]

const entry = (level: string, score: number, stars: number): ScoreEntry => ({
  level, score, maxScore: 0, stars, timestamp: 0,
})

describe('buildLevelCards', () => {
  it('reports stars, best score and the level that unlocks a locked card', () => {
    const scores = { a: entry('a', 800, 2) }
    const unlocked = (id: string) => id === 'a' || id === 'b'
    const cards = buildLevelCards(levels, scores, unlocked, {})
    expect(cards.map((c) => [c.id, c.unlocked, c.stars, c.bestScore, c.unlockedBy])).toEqual([
      ['a', true, 2, 800, null],
      ['b', true, 0, 0, null],
      ['c', false, 0, 0, 'Bravo'],
    ])
    expect(totalStars(cards)).toEqual({ earned: 2, max: 9 })
  })

  it('offers a Night Ride on a level with 3 stars and a night preset only (#829)', () => {
    const night = (scores: Record<string, ScoreEntry>, unlocked = (id: string) => id !== 'c') =>
      buildLevelCards(levels, scores, unlocked, {}).map((c) => c.nightRide)
    expect(night({ a: entry('a', 900, 3), b: entry('b', 900, 3) })).toEqual([true, false, false])
    expect(night({ a: entry('a', 900, 2) })).toEqual([false, false, false])
    expect(night({ a: entry('a', 900, 3) }, () => false)).toEqual([false, false, false])
    const level1 = getAllLevels().filter((l) => l.id === 'level1')
    expect(buildLevelCards(level1, { level1: entry('level1', 2000, 3) }, () => true, {})[0].nightRide).toBe(true)
  })

  it('shows the top initials of an open level only', () => {
    const top = (initials: string) => [{ initials, score: 900, stars: 2, date: 0 }]
    const boards = { a: top('BOB'), c: top('EVE') }
    const cards = buildLevelCards(levels, { a: entry('a', 900, 2) }, (id) => id !== 'c', boards)
    expect(cards.map((c) => c.bestInitials)).toEqual(['BOB', null, null])
  })

  it('takes the best score and its initials from the same entry when the board and the save disagree', () => {
    const board = { a: [{ initials: 'ZED', score: 700, stars: 2, date: 1 }] }
    const scores = { a: entry('a', 900, 2), b: entry('b', 400, 1) }
    const cards = buildLevelCards(levels, scores, (id) => id !== 'c', board)
    expect(cards.map((c) => [c.bestScore, c.bestInitials])).toEqual([
      [700, 'ZED'],
      [400, null],
      [0, null],
    ])
  })

  it('never counts stars on a locked level and clamps bad saves', () => {
    const scores = { a: entry('a', 10, 7), c: entry('c', 99, 3) }
    const cards = buildLevelCards(levels, scores, (id) => id === 'a', {})
    expect(cards[0].stars).toBe(3)
    expect(cards[2].stars).toBe(0)
    expect(cards[2].bestScore).toBe(0)
  })

  it('covers every registered level with 3 stars each', () => {
    const all = getAllLevels()
    const cards = buildLevelCards(all, {}, (id) => id === all[0].id, {})
    expect(totalStars(cards)).toEqual({ earned: 0, max: all.length * 3 })
    expect(cards.slice(1).every((c) => c.unlockedBy !== null)).toBe(true)
  })

  it('a locked card names the level the unlock rule waits on (previousLevel)', () => {
    const all = getAllLevels()
    const cards = buildLevelCards(all, {}, (id) => id === all[0].id, {})
    for (const c of cards.slice(1)) expect(c.unlockedBy, c.id).toBe(getLevelConfig(previousLevel(c.id)!)!.name)
  })
})

describe('nextLevelIndex', () => {
  const all = getAllLevels()
  const starred = (ids: string[], stars: number) => Object.fromEntries(ids.map((id) => [id, entry(id, 100, stars)]))
  /** The chain's unlock rule over `scores`, as the store's `isLevelUnlocked`. */
  const cardsFor = (scores: Record<string, ScoreEntry>, from: LevelSelectSource[] = all) =>
    buildLevelCards(from, scores, (id) => {
      const prev = previousLevel(id, from)
      return prev === null || (scores[prev]?.stars ?? 0) >= 1
    }, {})
  const next = (scores: Record<string, ScoreEntry>, lastLevel: string | null, from: LevelSelectSource[] = all) => {
    const cards = cardsFor(scores, from)
    return cards[nextLevelIndex(cards, lastLevel)].id
  }

  it('starts a new player on the first level, whatever was played last', () => {
    expect(next({}, null)).toBe('level1')
    expect(next({}, 'level2')).toBe('level1')
  })

  it('goes to the first unlocked level without a star', () => {
    expect(next(starred(['level1', 'level2'], 1), 'level1')).toBe('level3')
    expect(next({ a: entry('a', 1, 3), b: entry('b', 0, 0) }, 'a', levels)).toBe('b')
  })

  it('goes back to the last level played once every level has a star, so PLAY and the worlds\' focus agree (#818)', () => {
    const allStars = starred(all.map((l) => l.id), 3)
    expect(next(allStars, 'level4')).toBe('level4')
    expect(next(allStars, null)).toBe('level1')
    expect(next(allStars, 'gone')).toBe('level1')
  })

  it('never lands on a locked level', () => {
    const locked = buildLevelCards(levels, { a: entry('a', 1, 1), b: entry('b', 1, 1) }, (id) => id !== 'c', {})
    expect(locked[nextLevelIndex(locked, 'c')].id).toBe('a')
  })
})

describe('navigateCards', () => {
  const rect = (x: number, y: number): CardRect => ({ x, y, width: 100, height: 120 })
  const wrapped = [rect(0, 0), rect(110, 0), rect(220, 0), rect(55, 130), rect(165, 130)]
  const column = [rect(0, 0), rect(0, 130), rect(0, 260)]

  it('steps left / right in reading order and stops at the ends', () => {
    expect(navigateCards(wrapped, 0, 'ArrowLeft')).toBe(0)
    expect(navigateCards(wrapped, 2, 'ArrowRight')).toBe(3)
    expect(navigateCards(wrapped, 4, 'ArrowRight')).toBe(4)
    expect(navigateCards(wrapped, 3, 'Home')).toBe(0)
    expect(navigateCards(wrapped, 0, 'End')).toBe(4)
  })

  it('moves up / down to the nearest card in the adjacent row of a wrapped grid or a phone column', () => {
    expect(navigateCards(wrapped, 0, 'ArrowDown')).toBe(3)
    expect(navigateCards(wrapped, 2, 'ArrowDown')).toBe(4)
    expect(navigateCards(wrapped, 4, 'ArrowUp')).toBe(1)
    expect(navigateCards(wrapped, 1, 'ArrowUp')).toBe(1)
    expect(navigateCards(column, 0, 'ArrowDown')).toBe(1)
    expect(navigateCards(column, 2, 'ArrowUp')).toBe(1)
  })

  it('stays put on a single row', () => {
    const row = [rect(0, 0), rect(110, 0)]
    expect(navigateCards(row, 0, 'ArrowDown')).toBe(0)
    expect(navigateCards([], 0, 'ArrowRight')).toBe(0)
  })
})

describe('buildDailyCard', () => {
  const all = getAllLevels()
  const now = new Date('2026-10-31T15:00:00Z')

  it("shows today's level, today's best and a live streak", () => {
    const card = buildDailyCard(now, all, { '2026-10-31': entry('level1', 1234, 2) }, { count: 3, lastKey: '2026-10-30' })
    expect(card).toMatchObject({ dateKey: '2026-10-31', levelId: dailyLevel('2026-10-31'), bestScore: 1234, streak: 3 })
    expect(card.levelName).toBe(all.find((l) => l.id === card.levelId)!.name)
  })

  it('reads 0 for a best from another day and for a broken streak', () => {
    const card = buildDailyCard(now, all, { '2026-10-30': entry('level1', 99, 1) }, { count: 5, lastKey: '2026-10-28' })
    expect(card.bestScore).toBe(0)
    expect(card.streak).toBe(0)
  })
})
