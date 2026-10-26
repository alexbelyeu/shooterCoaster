import { describe, expect, it } from 'vitest'
import { startsGame } from './titleKeys'

const press = (key: string, mods: Partial<{ repeat: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}) =>
  startsGame({ key, repeat: false, ctrlKey: false, metaKey: false, altKey: false, ...mods })

describe('title press-any-key', () => {
  it('starts on letters, digits, Space, Enter and arrows', () => {
    for (const k of ['a', 'Z', '1', ' ', 'Enter', 'ArrowUp', 'ArrowRight']) expect(press(k)).toBe(true)
  })

  it('leaves the mute shortcut, focus, escape, function and modifier keys alone', () => {
    for (const k of ['s', 'S', 'Tab', 'Escape', 'F5', 'F12', 'Shift', 'Control', 'Meta', 'Alt', 'CapsLock']) expect(press(k)).toBe(false)
  })

  it('ignores browser shortcuts and key repeat', () => {
    expect(press('r', { ctrlKey: true })).toBe(false)
    expect(press('r', { metaKey: true })).toBe(false)
    expect(press('a', { altKey: true })).toBe(false)
    expect(press('a', { repeat: true })).toBe(false)
  })
})
