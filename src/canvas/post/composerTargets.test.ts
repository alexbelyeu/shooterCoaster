import { describe, expect, it, vi } from 'vitest'
import type { WebGLRenderTarget } from 'three'
import { freeComposerTargets } from './composerTargets'

const target = () => ({ dispose: vi.fn() }) as unknown as WebGLRenderTarget & { dispose: ReturnType<typeof vi.fn> }

describe('freeComposerTargets', () => {
  it('frees both render targets when the composer is swapped out or unmounted, not before', () => {
    const composer = { inputBuffer: target(), outputBuffer: target() }
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
