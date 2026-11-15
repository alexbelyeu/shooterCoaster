import { describe, expect, it } from 'vitest'
import { readyDone } from './countdownGate'

const warm = { shown: true, chunkLoaded: true, sceneReady: true, warmupTimedOut: false }

describe('readyDone', () => {
  it('moves on once Ready has shown over a loaded, warmed-up scene', () => {
    expect(readyDone(warm)).toBe(true)
    expect(readyDone({ ...warm, shown: false })).toBe(false)
  })

  it('waits for the level chunk however long it takes: the warm-up cap does not apply before it', () => {
    expect(readyDone({ ...warm, chunkLoaded: false, sceneReady: false, warmupTimedOut: true })).toBe(false)
    expect(readyDone({ ...warm, chunkLoaded: false })).toBe(false)
  })

  it('waits for the warm-up only until its cap once the chunk is in', () => {
    expect(readyDone({ ...warm, sceneReady: false })).toBe(false)
    expect(readyDone({ ...warm, sceneReady: false, warmupTimedOut: true })).toBe(true)
  })
})
