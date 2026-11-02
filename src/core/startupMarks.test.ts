import { describe, expect, it } from 'vitest'
import { markStartup, startupTimings } from './startupMarks'

describe('startup marks', () => {
  it('keeps the first time each phase happened, in order', async () => {
    expect(startupTimings()).toEqual({})
    markStartup('boot')
    await new Promise((r) => setTimeout(r, 5))
    markStartup('runStart')
    const first = startupTimings()
    expect(first.runStart!).toBeGreaterThan(first.boot!)

    await new Promise((r) => setTimeout(r, 5))
    markStartup('runStart')
    expect(startupTimings()).toEqual(first)
    expect(performance.getEntriesByName('sc:runStart', 'mark')).toHaveLength(1)
  })
})
