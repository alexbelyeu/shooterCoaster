import { describe, it, expect, vi } from 'vitest'
import { dropSound, droppedSounds, guarded } from './soundGuard'

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

  it('guarded passes its arguments through and drops a throw instead of raising it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const seen: [number, string][] = []
    const ok = guarded('music pad', (time: number, note: string) => void seen.push([time, note]))
    ok(1.5, 'C4')
    expect(seen).toEqual([[1.5, 'C4']])
    const before = droppedSounds().count
    const bad = guarded('music bass', () => {
      throw new Error('late note')
    })
    expect(() => bad()).not.toThrow()
    expect(droppedSounds().count).toBe(before + 1)
    expect(droppedSounds().last).toMatch(/^music bass: Error: late note/)
    warn.mockRestore()
  })
})
