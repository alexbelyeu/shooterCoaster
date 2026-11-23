import { describe, expect, it } from 'vitest'
import { BACK_OUT_GUARD_MS, BACK_OUT_WINDOW_MS, countdownBacksOut, isIntroSkipKey } from './introShot'

type Mods = Partial<Record<'repeat' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey', boolean>>
const key = (k: string, mods: Mods = {}) => ({
  key: k,
  repeat: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...mods,
})

describe('isIntroSkipKey', () => {
  it('skips on Space, Enter and Escape', () => {
    for (const k of [' ', 'Enter', 'Escape']) expect(isIntroSkipKey(key(k)), k).toBe(true)
  })

  it('ignores the mute key, other keys, modifiers and held keys (#686)', () => {
    for (const k of ['s', 'S', 'a', 'Shift', 'Control', 'Meta', 'Tab']) expect(isIntroSkipKey(key(k)), k).toBe(false)
    expect(isIntroSkipKey(key(' ', { repeat: true }))).toBe(false)
    expect(isIntroSkipKey(key('Enter', { ctrlKey: true }))).toBe(false)
    expect(isIntroSkipKey(key('Escape', { metaKey: true }))).toBe(false)
  })
})

describe('countdownBacksOut (#329)', () => {
  const titleSeat = { from: 'title' as const, tourOnScreen: false, msInSeat: 500 }

  it('backs a title run out on Escape in the seat in its first second', () => {
    expect(countdownBacksOut(key('Escape'), titleSeat)).toBe(true)
  })

  it('never backs out while the tour is on screen: there Escape skips it', () => {
    expect(countdownBacksOut(key('Escape'), { ...titleSeat, tourOnScreen: true })).toBe(false)
  })

  it('never backs out a run started anywhere but the title', () => {
    for (const from of ['select', 'results', 'pause'] as const) {
      expect(countdownBacksOut(key('Escape'), { ...titleSeat, from }), from).toBe(false)
    }
  })

  it('ignores the second press of a double-tap skip, and Escape after the first second', () => {
    expect(countdownBacksOut(key('Escape'), { ...titleSeat, msInSeat: 0 })).toBe(false)
    expect(countdownBacksOut(key('Escape'), { ...titleSeat, msInSeat: BACK_OUT_GUARD_MS - 1 })).toBe(false)
    expect(countdownBacksOut(key('Escape'), { ...titleSeat, msInSeat: BACK_OUT_GUARD_MS })).toBe(true)
    expect(countdownBacksOut(key('Escape'), { ...titleSeat, msInSeat: BACK_OUT_WINDOW_MS })).toBe(false)
  })

  it('only on a plain Escape', () => {
    for (const k of [' ', 'Enter', 'w']) expect(countdownBacksOut(key(k), titleSeat), k).toBe(false)
    expect(countdownBacksOut(key('Escape', { repeat: true }), titleSeat)).toBe(false)
    expect(countdownBacksOut(key('Escape', { shiftKey: true }), titleSeat)).toBe(false)
  })
})
