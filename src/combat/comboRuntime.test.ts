import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameStore } from '@/store/useGameStore'
import { eventBus } from '@/core/EventBus'
import { gameTime } from '@/core/gameClock'
import { FRENZY } from './comboTiers'
import { resetComboRuntime, tickCombo } from './comboRuntime'
import { resetSlowMo, setTimeScaleOverride, tickSlowMo } from './slowMo'

// zustand's persist wants window.localStorage; a bare in-memory one is enough here.
vi.hoisted(() => {
  const data = new Map<string, string>()
  ;(globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    },
  }
})

const initial = useGameStore.getState()
const store = () => useGameStore.getState()
const broken = vi.fn()
const frenzy = vi.fn()

/** One playing frame, as `GameTimer` runs it. */
function tick(delta: number) {
  tickCombo(delta)
  tickSlowMo(delta)
}

function kills(n: number, gapS = 0.1) {
  for (let i = 0; i < n; i++) {
    store().registerKill()
    tick(gapS)
  }
}

beforeEach(() => {
  useGameStore.setState(initial, true)
  resetComboRuntime()
  resetSlowMo()
  eventBus.on('combo:broken', broken)
  eventBus.on('combo:frenzy', frenzy)
})
afterEach(() => {
  eventBus.off('combo:broken', broken)
  eventBus.off('combo:frenzy', frenzy)
  broken.mockReset()
  frenzy.mockReset()
})

describe('game clock', () => {
  it('advances by delta × timeScale', () => {
    tick(1)
    setTimeScaleOverride(0.5)
    tick(1)
    expect(gameTime()).toBeCloseTo(1.5)
  })

  it('slow-mo stretches the window in real time', () => {
    kills(1)
    setTimeScaleOverride(0.35)
    tick(3)
    store().registerKill()
    expect(store().combo.count).toBe(2)
  })
})

describe('combo break', () => {
  it('lapses the chain once its window passes, and reports a 2×+ chain', () => {
    kills(5)
    tick(1.0)
    expect(store().combo.count).toBe(5)
    tick(1.0)
    expect(store().combo).toEqual({ count: 0, multiplier: 1, lastKillTime: 0 })
    expect(broken).toHaveBeenCalledOnce()
    expect(broken.mock.calls[0][0]).toMatchObject({ count: 5, tier: 1 })
  })

  it('a 1× chain lapses quietly', () => {
    kills(3)
    tick(3)
    expect(store().combo.count).toBe(0)
    expect(broken).not.toHaveBeenCalled()
  })
})

describe('frenzy', () => {
  it('starts on entering 5×, slows time, then hands back exactly 1', () => {
    kills(14)
    expect(frenzy).not.toHaveBeenCalled()
    kills(1, 0)
    expect(frenzy).toHaveBeenCalledOnce()
    expect(store().frenzy).toBe('on')
    tick(FRENZY.durationS / 2)
    expect(store().timeScale).toBeCloseTo(FRENZY.timeScale)
    tick(FRENZY.durationS)
    expect(store().timeScale).toBe(1)
    expect(store().frenzy).toBe('off')
  })

  it('waits out the cooldown before the next one', () => {
    kills(15)
    tick(5)
    kills(15)
    expect(frenzy).toHaveBeenCalledOnce()
    tick(3)
    tick(FRENZY.cooldownS)
    kills(15)
    expect(frenzy).toHaveBeenCalledTimes(2)
  })

  it('resetComboRuntime clears the clock and the cooldown', () => {
    kills(15)
    resetComboRuntime()
    expect(gameTime()).toBe(0)
    store().resetCombo()
    kills(15)
    expect(frenzy).toHaveBeenCalledTimes(2)
  })
})
