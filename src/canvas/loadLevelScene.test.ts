import { describe, expect, it, vi } from 'vitest'
import { importWithRetry } from './loadLevelScene'

describe('importWithRetry', () => {
  it('retries after each delay and resolves once an attempt succeeds', async () => {
    const importer = vi.fn().mockRejectedValueOnce(new Error('a')).mockRejectedValueOnce(new Error('b')).mockResolvedValue('ok')
    const waits: number[] = []
    await expect(importWithRetry(importer, [10, 20], async (ms) => void waits.push(ms))).resolves.toBe('ok')
    expect(importer).toHaveBeenCalledTimes(3)
    expect(waits).toEqual([10, 20])
  })

  it('gives up with the last error when every attempt fails', async () => {
    const importer = vi.fn().mockRejectedValue(new Error('down'))
    await expect(importWithRetry(importer, [1], async () => {})).rejects.toThrow('down')
    expect(importer).toHaveBeenCalledTimes(2)
  })
})
