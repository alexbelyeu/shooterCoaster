import { describe, expect, it } from 'vitest'
import { isHeldActivation, menuFocus } from './menuFocus'

describe('menuFocus', () => {
  const n = 5

  it('arrows step through the items and wrap at both ends', () => {
    expect(menuFocus(0, 'ArrowDown', n)).toBe(1)
    expect(menuFocus(n - 1, 'ArrowDown', n)).toBe(0)
    expect(menuFocus(0, 'ArrowUp', n)).toBe(n - 1)
    expect(menuFocus(2, 'ArrowLeft', n)).toBe(1)
    expect(menuFocus(2, 'ArrowRight', n)).toBe(3)
  })

  it('Home / End jump to the first / last item', () => {
    expect(menuFocus(2, 'Home', n)).toBe(0)
    expect(menuFocus(0, 'End', n)).toBe(n - 1)
  })

  it('other keys (Enter, Escape, Tab, letters) are not menu moves, and an empty menu has none', () => {
    for (const key of ['Enter', 'Escape', 'Tab', ' ', 'r']) expect(menuFocus(1, key, n)).toBeNull()
    expect(menuFocus(0, 'ArrowDown', 0)).toBeNull()
  })
})

describe('isHeldActivation', () => {
  it('is a repeated Enter or Space only', () => {
    expect(isHeldActivation('Enter', true)).toBe(true)
    expect(isHeldActivation(' ', true)).toBe(true)
    expect(isHeldActivation('Enter', false)).toBe(false)
    expect(isHeldActivation('ArrowDown', true)).toBe(false)
  })
})
