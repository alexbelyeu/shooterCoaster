import { describe, expect, it, vi } from 'vitest'

const unlockAudioContext = vi.fn()
const loadTone = vi.fn(() => new Promise<never>(() => {}))

vi.mock('./tone', () => ({ unlockAudioContext, loadTone, adoptGestureContext: vi.fn(), tone: vi.fn() }))

describe('initAudio', () => {
  it('resumes the context on every gesture call while Tone is still loading', async () => {
    const { initAudio, isAudioReady } = await import('./AudioEngine')
    void initAudio()
    void initAudio()
    expect(unlockAudioContext).toHaveBeenCalledTimes(2)
    expect(loadTone).toHaveBeenCalledTimes(1)
    expect(isAudioReady()).toBe(false)
  })
})
