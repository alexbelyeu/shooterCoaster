import { afterEach, describe, expect, it, vi } from 'vitest'

/** A context whose `resume` never settles: a touch `pointerdown` on iOS, before the PLAY click unlocks it. */
class StuckContext {
  static made: StuckContext[] = []
  state = 'suspended'
  resume = vi.fn(() => new Promise<void>(() => {}))
  constructor() {
    StuckContext.made.push(this)
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('initAudio', () => {
  it('creates one context and resumes it on every gesture call while it is still locked', async () => {
    vi.stubGlobal('AudioContext', StuckContext)
    vi.stubGlobal('window', { addEventListener: vi.fn(), location: { search: '' } })
    const { initAudio, isAudioReady } = await import('./AudioEngine')
    void initAudio()
    void initAudio()
    expect(StuckContext.made).toHaveLength(1)
    // Each gesture's own resume, plus the one `initAudio` waits on.
    expect(StuckContext.made[0].resume).toHaveBeenCalledTimes(3)
    expect(isAudioReady()).toBe(false)
  })
})
