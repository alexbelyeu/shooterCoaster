import { describe, expect, it, vi } from 'vitest'
import type { WebGLRenderTarget } from 'three'
import { composerSceneTarget, freeComposerTargets } from './composerTargets'

const fakeComposer = () => {
  const target = () => ({ dispose: vi.fn() }) as unknown as WebGLRenderTarget
  return { inputBuffer: target(), outputBuffer: target() }
}

describe('freeComposerTargets', () => {
  it('frees both render targets when the composer is swapped out or unmounted, not before', () => {
    const composer = fakeComposer()
    const cleanup = freeComposerTargets(composer)
    expect(composer.inputBuffer.dispose).not.toHaveBeenCalled()
    cleanup?.()
    expect(composer.inputBuffer.dispose).toHaveBeenCalledOnce()
    expect(composer.outputBuffer.dispose).toHaveBeenCalledOnce()
  })

  it('does nothing for a null ref', () => {
    expect(freeComposerTargets(null)).toBeUndefined()
  })

  it('reports the mounted composer’s scene target, and keeps the new one when an old cleanup runs late', () => {
    const title = fakeComposer()
    const level = fakeComposer()
    const cleanTitle = freeComposerTargets(title)
    expect(composerSceneTarget()).toBe(title.inputBuffer)
    const cleanLevel = freeComposerTargets(level)
    cleanTitle?.()
    expect(composerSceneTarget()).toBe(level.inputBuffer)
    cleanLevel?.()
    expect(composerSceneTarget()).toBeNull()
  })
})
