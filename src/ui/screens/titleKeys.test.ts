import { describe, expect, it } from 'vitest'
import { titleAction } from './titleKeys'

const press = (key: string, mods: Partial<{ repeat: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}) =>
  titleAction({ key, repeat: false, ctrlKey: false, metaKey: false, altKey: false, ...mods })

describe('title press-any-key', () => {
  it('plays on letters, digits, Space, Enter and arrows', () => {
    for (const k of ['a', 'Z', '1', ' ', 'Enter', 'ArrowUp', 'ArrowRight']) expect(press(k)).toBe('play')
  })

  it('opens the worlds on W and Escape', () => {
    for (const k of ['w', 'W', 'Escape']) expect(press(k)).toBe('worlds')
  })

  it('leaves the mute shortcut, focus, function and modifier keys alone', () => {
    for (const k of ['s', 'S', 'Tab', 'F5', 'F12', 'Shift', 'Control', 'Meta', 'Alt', 'CapsLock']) expect(press(k)).toBeNull()
  })

  it('ignores browser shortcuts and key repeat', () => {
    expect(press('r', { ctrlKey: true })).toBeNull()
    expect(press('w', { metaKey: true })).toBeNull()
    expect(press('a', { altKey: true })).toBeNull()
    expect(press('Escape', { repeat: true })).toBeNull()
  })
})
