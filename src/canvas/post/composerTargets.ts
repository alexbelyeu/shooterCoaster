import type { WebGLRenderTarget } from 'three'

interface ComposerTargets {
  inputBuffer: WebGLRenderTarget
  outputBuffer: WebGLRenderTarget
}

let live: ComposerTargets | null = null

/**
 * `<EffectComposer>` callback ref: the library rebuilds the composer on a `multisampling` change and never frees
 * the old one's render targets. Not `composer.dispose()`, which also disposes the shared grade effect.
 * It also keeps the mounted composer for `composerSceneTarget`.
 */
export function freeComposerTargets(composer: ComposerTargets | null) {
  if (!composer) return undefined
  live = composer
  return () => {
    if (live === composer) live = null
    composer.inputBuffer.dispose()
    composer.outputBuffer.dispose()
  }
}

/** The target the composer's render pass draws the scene into (its samples, format and depth attachment), if one is mounted. */
export function composerSceneTarget(): WebGLRenderTarget | null {
  return live?.inputBuffer ?? null
}
