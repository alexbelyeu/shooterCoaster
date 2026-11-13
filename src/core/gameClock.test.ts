import { beforeEach, describe, expect, it } from 'vitest'
import { advanceGameTime, gameClockStep, resetGameTime } from './gameClock'

describe('gameClockStep', () => {
  beforeEach(() => resetGameTime())

  it('returns the game seconds since its previous call, 0 on the first', () => {
    advanceGameTime(3)
    const step = gameClockStep()
    expect(step()).toBe(0)
    advanceGameTime(0.5)
    advanceGameTime(0.25)
    expect(step()).toBe(0.75)
    expect(step()).toBe(0)
  })

  it('never steps backwards when a new run resets the clock', () => {
    advanceGameTime(10)
    const step = gameClockStep()
    step()
    resetGameTime()
    expect(step()).toBe(0)
    advanceGameTime(1)
    expect(step()).toBe(1)
  })
})
