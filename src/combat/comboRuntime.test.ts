import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameStore } from '@/store/useGameStore'
import { eventBus } from '@/core/EventBus'
import { gameTime } from '@/core/gameClock'
import { FRENZY } from './comboTiers'
import { frenzyActive, resetComboRuntime, tickCombo } from './comboRuntime'

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

function kills(n: number, gapS = 0.1) {
  for (let i = 0; i < n; i++) {
    store().registerKill()
    tickCombo(gapS)
  }
}

beforeEach(() => {
  useGameStore.setState(initial, true)
  resetComboRuntime()
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
    tickCombo(1)
    store().setTimeScale(0.5)
    tickCombo(1)
    expect(gameTime()).toBeCloseTo(1.5)
  })

  it('a pause (no ticks) keeps the chain however long it lasts', () => {
    kills(3)
    // Paused: GameTimer does not tick, whatever the wall clock does.
    store().registerKill()
    expect(store().combo.count).toBe(4)
    expect(store().combo.multiplier).toBe(2)
  })

  it('slow-mo stretches the window in real time', () => {
    kills(1)
    store().setTimeScale(0.35)
    tickCombo(3) // 1.05 s of game time < 2.0 s window
    store().registerKill()
    expect(store().combo.count).toBe(2)
  })
})

describe('combo break', () => {
  it('lapses the chain once its window passes, and reports a 2×+ chain', () => {
    kills(5) // 2×, 1.8 s window
    tickCombo(1.0)
    expect(store().combo.count).toBe(5)
    tickCombo(1.0)
    expect(store().combo).toEqual({ count: 0, multiplier: 1, lastKillTime: 0 })
    expect(broken).toHaveBeenCalledOnce()
    expect(broken.mock.calls[0][0]).toMatchObject({ count: 5, tier: 1 })
  })

  it('a 1× chain lapses quietly', () => {
    kills(3)
    tickCombo(3)
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
    expect(frenzyActive()).toBe(true)
    tickCombo(FRENZY.durationS / 2)
    expect(store().timeScale).toBeCloseTo(FRENZY.timeScale)
    tickCombo(FRENZY.durationS)
    expect(store().timeScale).toBe(1)
    expect(frenzyActive()).toBe(false)
  })

  it('waits out the cooldown before the next one', () => {
    kills(15)
    tickCombo(5) // frenzy over, chain lapsed
    kills(15)
    expect(frenzy).toHaveBeenCalledOnce()
    tickCombo(3)
    tickCombo(FRENZY.cooldownS)
    kills(15)
    expect(frenzy).toHaveBeenCalledTimes(2)
  })

  it('yields to anyone else who sets the time scale', () => {
    kills(15)
    tickCombo(0.5)
    store().setTimeScale(0.1) // the last-enemy slow-mo
    tickCombo(0.5)
    expect(frenzyActive()).toBe(false)
    expect(store().timeScale).toBe(0.1)
  })

  it('resetComboRuntime ends it and clears the clock', () => {
    kills(15)
    resetComboRuntime()
    expect(frenzyActive()).toBe(false)
    expect(gameTime()).toBe(0)
  })
})

describe('startRun', () => {
  it('resets the time scale', () => {
    store().setTimeScale(0.35)
    store().startRun('level1', 1)
    expect(store().timeScale).toBe(1)
  })
})
