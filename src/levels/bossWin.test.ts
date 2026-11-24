import { describe, expect, it } from 'vitest'
import { BOSS_WIN_HOLD_SECONDS, bossWinEndsAt, nothingLeft } from './bossWin'
import { RUN_SECONDS } from './pacing'

describe('nothingLeft', () => {
  it('is true once the boss is beaten with no enemy, golden balloon or wave left', () => {
    expect(nothingLeft(true, 0, 0, null)).toBe(true)
  })

  it('waits for the boss', () => {
    expect(nothingLeft(false, 0, 0, null)).toBe(false)
  })

  it('goes on while an enemy is left to kill', () => {
    expect(nothingLeft(true, 1, 0, null)).toBe(false)
  })

  it('goes on while a golden balloon is still up', () => {
    expect(nothingLeft(true, 0, 1, null)).toBe(false)
  })

  it('goes on while a wave is still to come, even one already past due', () => {
    expect(nothingLeft(true, 0, 0, 52)).toBe(false)
    expect(nothingLeft(true, 0, 0, 30)).toBe(false)
  })
})

describe('bossWinEndsAt', () => {
  it('ends the run after the hold', () => {
    expect(bossWinEndsAt(48)).toBe(48 + BOSS_WIN_HOLD_SECONDS)
  })

  it('leaves a clear in the last seconds to the timer', () => {
    expect(bossWinEndsAt(RUN_SECONDS - BOSS_WIN_HOLD_SECONDS)).toBeNull()
    expect(bossWinEndsAt(RUN_SECONDS - 1)).toBeNull()
    expect(bossWinEndsAt(RUN_SECONDS - BOSS_WIN_HOLD_SECONDS - 0.1)).toBeCloseTo(RUN_SECONDS - 0.1)
  })

  it('takes the run length', () => {
    expect(bossWinEndsAt(25, 30)).toBe(28)
    expect(bossWinEndsAt(28, 30)).toBeNull()
  })
})
