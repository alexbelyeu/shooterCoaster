import { describe, expect, it } from 'vitest'
import { getAllLevels } from './LevelRegistry'
import {
  RUSH_STARS,
  STAGE_LEAD_SECONDS,
  bestAfter,
  formatRushTime,
  isNewBest,
  rushStages,
  rushUnlocked,
  sanitizeRushBest,
  stageSeconds,
  stagesCleared,
} from './bossRush'

describe('boss rush', () => {
  it('has a stage for every shipped level with a boss, in campaign order, starting before its boss', () => {
    const levels = getAllLevels()
    const stages = rushStages(levels)
    expect(stages.map((s) => s.levelId)).toEqual(levels.filter((l) => l.boss).map((l) => l.id))
    expect(stages.length).toBeGreaterThan(1)
    for (const stage of stages) {
      const boss = levels.find((l) => l.id === stage.levelId)!.boss!
      expect(stage.startAt).toBe(boss.at - STAGE_LEAD_SECONDS)
    }
  })

  it('skips a level without a boss and never starts before the ride does', () => {
    const stages = rushStages([
      { id: 'a', boss: { type: 'kraken', at: 40 } },
      { id: 'b' },
      { id: 'c', boss: { type: 'yeti', at: 2 } },
    ])
    expect(stages).toEqual([
      { levelId: 'a', startAt: 40 - STAGE_LEAD_SECONDS },
      { levelId: 'c', startAt: 0 },
    ])
  })

  it('opens only with every level at three stars', () => {
    const levels = getAllLevels()
    const all = (n: number) => () => n
    expect(rushUnlocked(levels, all(RUSH_STARS))).toBe(true)
    expect(rushUnlocked(levels, all(RUSH_STARS - 1))).toBe(false)
    const last = levels[levels.length - 1].id
    expect(rushUnlocked(levels, (id) => (id === last ? 2 : 3))).toBe(false)
    expect(rushUnlocked([], all(RUSH_STARS))).toBe(false)
  })

  it('times a stage from its start, and counts the stages cleared', () => {
    const stage = { levelId: 'a', startAt: 35 }
    expect(stageSeconds(stage, 52.5)).toBe(17.5)
    expect(stageSeconds(stage, 30)).toBe(0)
    expect(stagesCleared(0, false)).toBe(0)
    expect(stagesCleared(2, true)).toBe(3)
  })

  it('keeps the fastest whole rush as the best', () => {
    expect(isNewBest(100, null)).toBe(true)
    expect(isNewBest(99, 100)).toBe(true)
    expect(isNewBest(100, 100)).toBe(false)
    expect(bestAfter(null, 120, true)).toBe(120)
    expect(bestAfter(100, 90, true)).toBe(90)
    expect(bestAfter(100, 110, true)).toBe(100)
    // A rush that lost a stage sets no time, however short.
    expect(bestAfter(100, 20, false)).toBe(100)
    expect(bestAfter(null, 20, false)).toBe(null)
  })

  it('reads a saved best back only as a positive number', () => {
    expect(sanitizeRushBest(95.25)).toBe(95.25)
    for (const bad of [0, -3, Number.NaN, Infinity, '95', null, undefined, {}]) expect(sanitizeRushBest(bad)).toBe(null)
  })

  it('shows a time as minutes, seconds and tenths, rounded down', () => {
    expect(formatRushTime(0)).toBe('0:00.0')
    expect(formatRushTime(9.99)).toBe('0:09.9')
    expect(formatRushTime(83.45)).toBe('1:23.4')
    expect(formatRushTime(600.1)).toBe('10:00.1')
  })
})
