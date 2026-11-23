import { describe, expect, it } from 'vitest'
import { PAUSE_MENU } from './pauseMenu'

describe('PAUSE_MENU', () => {
  it('Resume comes first, so it is the default focus; Photo (#828) sits after Restart', () => {
    expect(PAUSE_MENU.map((b) => b.label)).toEqual(['Resume', 'Restart', 'Photo', 'Settings', 'Quit'])
    expect(PAUSE_MENU.find((b) => b.label === 'Photo')?.action).toBe('photo')
  })
})
