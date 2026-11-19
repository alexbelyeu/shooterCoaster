import { beforeEach, describe, expect, it } from 'vitest'
import { loadFraction, loadStage, reportLoad, resetLoad } from './loadProgress'

describe('loadProgress', () => {
  beforeEach(() => resetLoad('level1'))

  it('fills the bar from 0 to 1 as every stage completes', () => {
    expect(loadFraction()).toBe(0)
    reportLoad('level1', 'chunk', 1)
    reportLoad('level1', 'scene', 1)
    reportLoad('level1', 'shaders', 0.5)
    const part = loadFraction()
    expect(part).toBeGreaterThan(0)
    expect(part).toBeLessThan(1)
    reportLoad('level1', 'shaders', 1)
    reportLoad('level1', 'audio', 1)
    expect(loadFraction()).toBeCloseTo(1, 10)
  })

  it('never goes back, clamps, and drops another level\'s reports', () => {
    reportLoad('level1', 'shaders', 0.6)
    reportLoad('level1', 'shaders', 0.3)
    expect(loadStage('shaders')).toBe(0.6)
    reportLoad('level1', 'chunk', 7)
    expect(loadStage('chunk')).toBe(1)
    reportLoad('level2', 'audio', 1)
    expect(loadStage('audio')).toBe(0)
  })

  it('counts a skipped stage as done', () => {
    reportLoad('level1', 'chunk', 1)
    reportLoad('level1', 'scene', 1)
    reportLoad('level1', 'shaders', 1)
    expect(loadFraction()).toBeLessThan(1)
    expect(loadFraction('audio')).toBeCloseTo(1, 10)
  })

  it('starts a new level from nothing', () => {
    reportLoad('level1', 'chunk', 1)
    resetLoad('level2')
    expect(loadFraction()).toBe(0)
  })
})
