import { describe, expect, it } from 'vitest'
import { cycleLetter, initialsKey } from './initialsEntry'

describe('cycleLetter', () => {
  it('steps one slot and wraps Z <-> A', () => {
    expect(cycleLetter('AAA', 1, 1)).toBe('ABA')
    expect(cycleLetter('AAZ', 2, 1)).toBe('AAA')
    expect(cycleLetter('AAA', 0, -1)).toBe('ZAA')
    expect(cycleLetter('-AA', 0, 1)).toBe('BAA')
  })
})

describe('initialsKey', () => {
  const at = (letters: string, slot: number) => ({ letters, slot })

  it('Up / Down cycle the letter in the slot', () => {
    expect(initialsKey(at('AAA', 0), 'ArrowUp')).toEqual(at('BAA', 0))
    expect(initialsKey(at('AAA', 2), 'ArrowDown')).toEqual(at('AAZ', 2))
  })

  it('Left / Right / Backspace move the slot, clamped', () => {
    expect(initialsKey(at('AAA', 0), 'ArrowLeft')).toEqual(at('AAA', 0))
    expect(initialsKey(at('AAA', 1), 'Backspace')).toEqual(at('AAA', 0))
    expect(initialsKey(at('AAA', 2), 'ArrowRight')).toEqual(at('AAA', 2))
  })

  it('typing sets the letter and advances; R is a letter here, not replay', () => {
    let s = at('AAA', 0)
    for (const k of ['r', 'e', 'x', 'q']) s = initialsKey(s, k) as typeof s
    expect(s).toEqual(at('REQ', 2))
  })

  it('Enter confirms; other keys are left alone', () => {
    expect(initialsKey(at('ABC', 1), 'Enter')).toBe('confirm')
    for (const k of ['1', ' ', 'Escape', 'Shift', 'é']) expect(initialsKey(at('ABC', 1), k)).toBeNull()
  })
})
