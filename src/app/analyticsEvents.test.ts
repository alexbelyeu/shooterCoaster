import { describe, expect, it } from 'vitest'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { RUN_SECONDS } from '@/levels/pacing'
import type { GamePhase } from '@/types/game'
import { analyticsEventFor, shareEvent, tensPercent, type RunSnapshot } from './analyticsEvents'

const level1 = getLevelConfig('level1')!

function snap(phase: GamePhase, extra: Partial<RunSnapshot> = {}): RunSnapshot {
  return { phase, runId: 1, currentLevel: 'level1', runMode: { mode: 'campaign' }, runFrom: 'select', score: 0, timeRemaining: RUN_SECONDS, ...extra }
}

describe('analyticsEventFor', () => {
  it('sends level_start when a run begins, with the screen that started it', () => {
    const start = (from: string) => ({ name: 'level_start', props: { level: 'level1', from } })
    expect(analyticsEventFor(snap('levelSelect', { currentLevel: null }), snap('playing'))).toEqual(start('select'))
    expect(analyticsEventFor(snap('levelSelect'), snap('countdown'))).toEqual(start('select'))
    expect(analyticsEventFor(snap('title', { currentLevel: null }), snap('loading', { runFrom: 'title' }))).toEqual(start('title'))
    expect(analyticsEventFor(snap('results'), snap('playing', { runFrom: 'results' }))).toEqual(start('results'))
    expect(analyticsEventFor(snap('results'), snap('countdown', { runFrom: 'results' }))).toEqual(start('results'))
  })

  it('sends level_start on a Restart from the pause menu, a new run without leaving one', () => {
    const start = { name: 'level_start', props: { level: 'level1', from: 'pause' } }
    expect(analyticsEventFor(snap('paused'), snap('countdown', { runId: 2, runFrom: 'pause' }))).toEqual(start)
    expect(analyticsEventFor(snap('playing'), snap('playing', { runId: 2, runFrom: 'pause' }))).toEqual(start)
  })

  it('tags any Daily Run start as daily, whichever screen started it', () => {
    const daily = { runMode: { mode: 'daily', dateKey: '2026-10-31' } } as const
    const event = { name: 'level_start', props: { level: 'level1', from: 'daily' } }
    expect(analyticsEventFor(snap('levelSelect'), snap('countdown', daily))).toEqual(event)
    expect(analyticsEventFor(snap('results'), snap('countdown', { ...daily, runFrom: 'results' }))).toEqual(event)
  })

  it('counts a countdown that ends in GO as one start', () => {
    expect(analyticsEventFor(snap('countdown'), snap('playing'))).toBeNull()
    expect(analyticsEventFor(snap('countdown'), snap('paused'))).toBeNull()
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
    const timeRemaining = RUN_SECONDS * 0.75
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

  it('keeps every event to at most 2 properties: the level id, where a run started and small integers (Vercel Pro)', () => {
    const events = [
      analyticsEventFor(snap('levelSelect'), snap('playing')),
      analyticsEventFor(snap('playing'), snap('results', { score: 123.4 })),
      analyticsEventFor(snap('paused'), snap('title', { timeRemaining: 1.7 })),
    ]
    for (const event of events) {
      const values = Object.values(event!.props)
      expect(values.length).toBeLessThanOrEqual(2)
      for (const value of values) {
        expect(typeof value === 'number' ? Number.isInteger(value) : value === 'level1' || value === 'select').toBe(true)
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

describe('shareEvent', () => {
  it("carries the level and the method, and a Daily Run's share as level `daily` (#268)", () => {
    expect(shareEvent('level3', 'x', false)).toEqual({ name: 'share', props: { level: 'level3', method: 'x' } })
    expect(shareEvent('level3', 'image_native', true)).toEqual({ name: 'share', props: { level: 'daily', method: 'image_native' } })
  })
})
