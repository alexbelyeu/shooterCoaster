interface Disposable {
  dispose(): void
}

/**
 * `<EffectComposer>` callback ref: the library rebuilds the composer on a `multisampling` change and never frees
 * the old one's render targets. Not `composer.dispose()`, which also disposes the shared grade effect.
 */
export function freeComposerTargets(composer: { inputBuffer: Disposable; outputBuffer: Disposable } | null) {
  if (!composer) return undefined
  return () => {
    composer.inputBuffer.dispose()
    composer.outputBuffer.dispose()
  }
}
