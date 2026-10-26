import { describe, expect, it } from 'vitest'
import { getAllLevels } from '@/levels/LevelRegistry'
import type { ScoreEntry } from '@/types/game'
import {
  buildLevelCards,
  initialFocusIndex,
  navigateCards,
  totalStars,
  type CardRect,
  type LevelSelectSource,
} from './levelSelectModel'

const levels: LevelSelectSource[] = [
  { id: 'a', name: 'Alpha', description: '', biome: 'themePark', maxScore: 1000, nextLevel: 'b' },
  { id: 'b', name: 'Bravo', description: '', biome: 'desert', maxScore: 2000, nextLevel: 'c' },
  { id: 'c', name: 'Charlie', description: '', biome: 'ocean', maxScore: 3000, nextLevel: null },
]

const entry = (level: string, score: number, stars: number): ScoreEntry => ({
  level, score, maxScore: 0, stars, timestamp: 0,
})

describe('buildLevelCards', () => {
  it('reports stars, best score and the level that unlocks a locked card', () => {
    const scores = { a: entry('a', 800, 2) }
    const unlocked = (id: string) => id === 'a' || id === 'b'
    const cards = buildLevelCards(levels, scores, unlocked)
    expect(cards.map((c) => [c.id, c.unlocked, c.stars, c.bestScore, c.unlockedBy])).toEqual([
      ['a', true, 2, 800, null],
      ['b', true, 0, 0, null],
      ['c', false, 0, 0, 'Bravo'],
    ])
    expect(totalStars(cards)).toEqual({ earned: 2, max: 9 })
  })

  it('never counts stars on a locked level and clamps bad saves', () => {
    const scores = { a: entry('a', 10, 7), c: entry('c', 99, 3) }
    const cards = buildLevelCards(levels, scores, (id) => id === 'a')
    expect(cards[0].stars).toBe(3)
    expect(cards[2].stars).toBe(0)
    expect(cards[2].bestScore).toBe(0)
  })

  it('covers every registered level with 3 stars each', () => {
    const all = getAllLevels()
    const cards = buildLevelCards(all, {}, (id) => id === all[0].id)
    expect(totalStars(cards)).toEqual({ earned: 0, max: all.length * 3 })
    expect(cards.slice(1).every((c) => c.unlockedBy !== null)).toBe(true)
  })
})

describe('initialFocusIndex', () => {
  it('focuses the next level to play, else the last unlocked', () => {
    const fresh = buildLevelCards(levels, {}, (id) => id === 'a')
    expect(initialFocusIndex(fresh)).toBe(0)
    const partway = buildLevelCards(levels, { a: entry('a', 1, 1) }, (id) => id !== 'c')
    expect(initialFocusIndex(partway)).toBe(1)
    const done = buildLevelCards(levels, { a: entry('a', 1, 1), b: entry('b', 1, 2) }, (id) => id !== 'c')
    expect(initialFocusIndex(done)).toBe(1)
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
