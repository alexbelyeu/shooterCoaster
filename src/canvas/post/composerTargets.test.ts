import { describe, expect, it, vi } from 'vitest'
import { freeComposerTargets } from './composerTargets'

describe('freeComposerTargets', () => {
  it('frees both render targets when the composer is swapped out or unmounted, not before', () => {
    const composer = { inputBuffer: { dispose: vi.fn() }, outputBuffer: { dispose: vi.fn() } }
    const cleanup = freeComposerTargets(composer)
    expect(composer.inputBuffer.dispose).not.toHaveBeenCalled()
    cleanup?.()
    expect(composer.inputBuffer.dispose).toHaveBeenCalledOnce()
    expect(composer.outputBuffer.dispose).toHaveBeenCalledOnce()
  })

  it('does nothing for a null ref', () => {
    expect(freeComposerTargets(null)).toBeUndefined()
  })
})
