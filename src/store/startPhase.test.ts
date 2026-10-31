import { describe, expect, it } from 'vitest'
import { isInRun, isLevelActive, startPhaseFor } from './startPhase'
import type { GamePhase } from '@/types/game'

describe('startPhaseFor', () => {
  it('starts every real run with the countdown', () => {
    expect(startPhaseFor('')).toBe('countdown')
    expect(startPhaseFor('?seed=7')).toBe('countdown')
  })

  it('skips it under the e2e hook unless countdown=1 asks for it', () => {
    expect(startPhaseFor('?e2e=1')).toBe('playing')
    expect(startPhaseFor('?e2e=1&seed=7')).toBe('playing')
    expect(startPhaseFor('?e2e=1&countdown=1')).toBe('countdown')
  })
})

describe('phase predicates', () => {
  const phases: GamePhase[] = ['title', 'levelSelect', 'countdown', 'playing', 'paused', 'results']

  it('isInRun: countdown, playing and paused', () => {
    expect(phases.filter(isInRun)).toEqual(['countdown', 'playing', 'paused'])
  })

  it('isLevelActive: countdown and playing, not paused', () => {
    expect(phases.filter(isLevelActive)).toEqual(['countdown', 'playing'])
  })
})
