import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameStore } from '@/store/useGameStore'
import { FRENZY, LAST_KILL } from './comboTiers'
import { endSlowMo, requestSlowMo, resetSlowMo, setTimeScaleOverride, tickSlowMo, timeScaleOverride } from './slowMo'

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
const holdFeedback = (on: boolean) => Object.assign(window, { __SC_TEST__: { holdFeedback: on } })

beforeEach(() => {
  useGameStore.setState(initial, true)
  resetSlowMo()
  Reflect.deleteProperty(window, '__SC_TEST__')
})

describe('frenzy envelope', () => {
  it('eases down, holds, fades its flash out over the ease back and ends at exactly 1', () => {
    requestSlowMo('frenzy')
    expect(store()).toMatchObject({ timeScale: 1, frenzy: 'on' })
    tickSlowMo(FRENZY.durationS / 2)
    expect(store().timeScale).toBeCloseTo(FRENZY.timeScale)
    expect(store().frenzy).toBe('on')
    tickSlowMo(FRENZY.durationS / 2 - FRENZY.easeS / 2)
    expect(store().frenzy).toBe('out')
    tickSlowMo(FRENZY.easeS)
    expect(store()).toMatchObject({ timeScale: 1, frenzy: 'off' })
  })

  it('holds deep, flash on, under e2e holdFeedback', () => {
    holdFeedback(true)
    requestSlowMo('frenzy')
    for (let i = 0; i < 10; i++) tickSlowMo(1)
    expect(store()).toMatchObject({ timeScale: FRENZY.timeScale, frenzy: 'on' })
    holdFeedback(false)
    tickSlowMo(FRENZY.durationS)
    expect(store()).toMatchObject({ timeScale: 1, frenzy: 'off' })
  })
})

describe('last-kill slow-mo', () => {
  it('drops to its scale at once and hands back 1 after its real seconds', () => {
    requestSlowMo('lastKill')
    expect(store().timeScale).toBe(LAST_KILL.timeScale)
    tickSlowMo(LAST_KILL.durationS - 0.01)
    expect(store().timeScale).toBe(LAST_KILL.timeScale)
    tickSlowMo(0.02)
    expect(store().timeScale).toBe(1)
  })

  it('beats a running frenzy, which carries on underneath', () => {
    requestSlowMo('frenzy')
    tickSlowMo(0.5)
    requestSlowMo('lastKill')
    expect(store()).toMatchObject({ timeScale: LAST_KILL.timeScale, frenzy: 'on' })
    tickSlowMo(LAST_KILL.durationS)
    expect(store()).toMatchObject({ timeScale: 1, frenzy: 'off' })
  })
})

describe('override (debug freeze, e2e setTimeScale)', () => {
  it('beats every envelope until cleared', () => {
    requestSlowMo('frenzy')
    requestSlowMo('lastKill')
    setTimeScaleOverride(0)
    expect(store().timeScale).toBe(0)
    expect(timeScaleOverride()).toBe(0)
    setTimeScaleOverride(null)
    expect(store().timeScale).toBe(LAST_KILL.timeScale)
  })

  it('survives endSlowMo, not endSlowMo(true) or a new run', () => {
    setTimeScaleOverride(0.25)
    endSlowMo()
    expect(store().timeScale).toBe(0.25)
    endSlowMo(true)
    expect(store().timeScale).toBe(1)
    setTimeScaleOverride(0)
    resetSlowMo()
    expect(timeScaleOverride()).toBeNull()
  })
})

describe('run end', () => {
  it('endSlowMo hands back exactly 1 and clears the flash mid-envelope', () => {
    requestSlowMo('frenzy')
    requestSlowMo('lastKill')
    tickSlowMo(0.5)
    endSlowMo()
    expect(store()).toMatchObject({ timeScale: 1, frenzy: 'off' })
  })

  it('startRun resets the store side', () => {
    requestSlowMo('frenzy')
    tickSlowMo(0.5)
    store().startRun('level1', 1)
    expect(store()).toMatchObject({ timeScale: 1, frenzy: 'off' })
  })
})

describe('one owner', () => {
  const SOURCES: Record<string, string> = import.meta.glob(['../**/*.{ts,tsx}', '!../**/*.test.*'], { query: '?raw', import: 'default', eager: true })

  it('only combat/slowMo.ts writes timeScale or the frenzy stage (the dev turntable aside)', () => {
    const exempt = ['./slowMo.ts', '../store/useGameStore.ts']
    const writers = Object.keys(SOURCES).filter((path) =>
      !exempt.includes(path) && !path.startsWith('../dev/') &&
      /\.setSlowMo\(|\.setTimeScale\(|setState\(\{[^}]*\b(timeScale|frenzy)\b/.test(SOURCES[path]))
    expect(writers).toEqual([])
    expect(Object.keys(SOURCES).length).toBeGreaterThan(100)
  })
})
