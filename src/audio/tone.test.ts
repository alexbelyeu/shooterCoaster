import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

class FakeContext {
  static instances: FakeContext[] = []
  state = 'suspended'
  resume = vi.fn(() => Promise.resolve())
  constructor() {
    FakeContext.instances.push(this)
  }
}

const addEventListener = vi.fn()

beforeEach(() => {
  FakeContext.instances = []
  addEventListener.mockClear()
  vi.resetModules()
  vi.stubGlobal('AudioContext', FakeContext)
  vi.stubGlobal('window', { addEventListener })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('unlockAudioContext', () => {
  it('creates one context and resumes it on every call', async () => {
    const { unlockAudioContext } = await import('./tone')
    unlockAudioContext()
    // The touch pointerdown's resume does nothing on iOS; the PLAY click's call must try again.
    unlockAudioContext()
    expect(FakeContext.instances).toHaveLength(1)
    expect(FakeContext.instances[0].resume).toHaveBeenCalledTimes(2)
    expect(addEventListener).toHaveBeenCalledTimes(2)
  })

  it('registers the touchend / click resume listeners when it creates the context, before Tone loads', async () => {
    const { unlockAudioContext, toneLoaded } = await import('./tone')
    unlockAudioContext()
    expect(toneLoaded()).toBe(false)
    expect(addEventListener.mock.calls.map((c) => c[0])).toEqual(['touchend', 'click'])
  })
})
