import { describe, expect, it } from 'vitest'
import { PAUSE_MENU, pauseMenuFocus } from './pauseMenu'

describe('pauseMenuFocus', () => {
  const n = PAUSE_MENU.length

  it('arrows step through the buttons and wrap at both ends', () => {
    expect(pauseMenuFocus(0, 'ArrowDown', n)).toBe(1)
    expect(pauseMenuFocus(n - 1, 'ArrowDown', n)).toBe(0)
    expect(pauseMenuFocus(0, 'ArrowUp', n)).toBe(n - 1)
    expect(pauseMenuFocus(2, 'ArrowLeft', n)).toBe(1)
    expect(pauseMenuFocus(2, 'ArrowRight', n)).toBe(3)
  })

  it('Home / End jump to the first / last button', () => {
    expect(pauseMenuFocus(2, 'Home', n)).toBe(0)
    expect(pauseMenuFocus(0, 'End', n)).toBe(n - 1)
  })

  it('other keys (Enter, Escape, letters) are not menu moves', () => {
    for (const key of ['Enter', 'Escape', ' ', 'r']) expect(pauseMenuFocus(1, key, n)).toBeNull()
  })

  it('Resume comes first, so it is the default focus', () => {
    expect(PAUSE_MENU.map((b) => b.label)).toEqual(['Resume', 'Restart', 'Settings', 'Quit'])
  })
})
