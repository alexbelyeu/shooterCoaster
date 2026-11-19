import { describe, expect, it } from 'vitest'
import { isInRun, isLevelActive, phaseAfterLoading, startPhaseFor } from './startPhase'
import type { GamePhase } from '@/types/game'

describe('startPhaseFor', () => {
  const cold = { warm: false, replay: false }

  it('opens every real run on the loading screen', () => {
    expect(startPhaseFor({ search: '', ...cold })).toBe('loading')
    expect(startPhaseFor({ search: '?seed=7', ...cold })).toBe('loading')
    // A new start of a warm level still passes through it (it ends at once), then plays the intro.
    expect(startPhaseFor({ search: '', warm: true, replay: false })).toBe('loading')
    // A restart that must reload still loads.
    expect(startPhaseFor({ search: '', warm: false, replay: true })).toBe('loading')
  })

  it('takes a warm restart straight to the countdown', () => {
    expect(startPhaseFor({ search: '', warm: true, replay: true })).toBe('countdown')
  })

  it('skips it all under the e2e hook unless countdown=1 asks for it', () => {
    expect(startPhaseFor({ search: '?e2e=1', ...cold })).toBe('playing')
    expect(startPhaseFor({ search: '?e2e=1&seed=7', warm: true, replay: true })).toBe('playing')
    expect(startPhaseFor({ search: '?e2e=1&countdown=1', ...cold })).toBe('loading')
  })
})

describe('phaseAfterLoading', () => {
  it('plays the intro on a fresh start only', () => {
    expect(phaseAfterLoading(false, false)).toBe('intro')
    expect(phaseAfterLoading(true, false)).toBe('countdown')
    expect(phaseAfterLoading(false, true)).toBe('countdown')
  })
})

describe('phase predicates', () => {
  const phases: GamePhase[] = ['title', 'levelSelect', 'loading', 'intro', 'countdown', 'playing', 'paused', 'results']

  it('isInRun: loading through paused', () => {
    expect(phases.filter(isInRun)).toEqual(['loading', 'intro', 'countdown', 'playing', 'paused'])
  })

  it('isLevelActive: intro, countdown and playing, not loading or paused', () => {
    expect(phases.filter(isLevelActive)).toEqual(['intro', 'countdown', 'playing'])
  })
})
