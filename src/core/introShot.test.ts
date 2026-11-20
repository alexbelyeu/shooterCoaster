import { describe, expect, it } from 'vitest'
import { isIntroSkipKey } from './introShot'

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
