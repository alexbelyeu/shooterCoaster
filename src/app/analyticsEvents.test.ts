import { describe, expect, it } from 'vitest'
import { getLevelConfig } from '@/levels/LevelRegistry'
import type { GamePhase } from '@/types/game'
import { analyticsEventFor, tensPercent, type RunSnapshot } from './analyticsEvents'

const level1 = getLevelConfig('level1')!

function snap(phase: GamePhase, extra: Partial<RunSnapshot> = {}): RunSnapshot {
  return { phase, currentLevel: 'level1', score: 0, timeRemaining: level1.timerSeconds, ...extra }
}

describe('analyticsEventFor', () => {
  it('sends level_start when a run begins from the menu or the results screen', () => {
    const start = { name: 'level_start', props: { level: 'level1' } }
    expect(analyticsEventFor(snap('levelSelect', { currentLevel: null }), snap('playing'))).toEqual(start)
    expect(analyticsEventFor(snap('results'), snap('playing'))).toEqual(start)
  })

  it('does not count pausing or resuming', () => {
    expect(analyticsEventFor(snap('playing'), snap('paused'))).toBeNull()
    expect(analyticsEventFor(snap('paused'), snap('playing'))).toBeNull()
  })

  it('sends level_complete with the stars the results screen shows', () => {
    const score = level1.maxScore * 0.64
    expect(analyticsEventFor(snap('playing'), snap('results', { score, timeRemaining: 0 }))).toEqual({
      name: 'level_complete',
      props: { level: 'level1', stars: 2 },
    })
  })

  it('sends level_quit with the share of the timer used', () => {
    const timeRemaining = level1.timerSeconds * 0.75
    const quit = { name: 'level_quit', props: { level: 'level1', progress_pct: 20 } }
    expect(analyticsEventFor(snap('paused'), snap('levelSelect', { timeRemaining }))).toEqual(quit)
    expect(analyticsEventFor(snap('playing'), snap('title', { timeRemaining }))).toEqual(quit)
  })

  it('ignores menu navigation, leaving the results screen and repeated phases', () => {
    expect(analyticsEventFor(snap('title'), snap('levelSelect'))).toBeNull()
    expect(analyticsEventFor(snap('results'), snap('levelSelect'))).toBeNull()
    expect(analyticsEventFor(snap('playing'), snap('playing', { score: 50 }))).toBeNull()
  })

  it('sends nothing for an unknown level', () => {
    expect(analyticsEventFor(snap('levelSelect'), snap('playing', { currentLevel: 'nope' }))).toBeNull()
  })

  it('keeps every event to at most 2 properties: the level id and small integers (Vercel Pro)', () => {
    const events = [
      analyticsEventFor(snap('levelSelect'), snap('playing')),
      analyticsEventFor(snap('playing'), snap('results', { score: 123.4 })),
      analyticsEventFor(snap('paused'), snap('title', { timeRemaining: 1.7 })),
    ]
    for (const event of events) {
      const values = Object.values(event!.props)
      expect(values.length).toBeLessThanOrEqual(2)
      for (const value of values) {
        expect(typeof value === 'number' ? Number.isInteger(value) : value === 'level1').toBe(true)
      }
    }
  })
})

describe('tensPercent', () => {
  it('floors to whole tens and clamps to 0..100', () => {
    expect(tensPercent(0)).toBe(0)
    expect(tensPercent(0.999)).toBe(90)
    expect(tensPercent(1)).toBe(100)
    expect(tensPercent(1.3)).toBe(100)
    expect(tensPercent(-0.2)).toBe(0)
  })
})
