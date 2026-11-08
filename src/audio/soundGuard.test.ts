import { describe, it, expect, vi } from 'vitest'
import { dropSound, droppedSounds } from './soundGuard'

describe('soundGuard', () => {
  it('counts every drop, keeps the last one and warns once per call site', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const before = droppedSounds().count
    dropSound('fire', new Error('Start time must be strictly greater than previous start time'))
    dropSound('fire', new Error('again'))
    expect(droppedSounds().count).toBe(before + 2)
    expect(droppedSounds().last).toMatch(/^fire: Error: again/)
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})
