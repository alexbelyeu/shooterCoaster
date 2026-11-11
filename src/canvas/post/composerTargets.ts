import type { EffectComposer } from 'postprocessing'

/**
 * Callback ref for `<EffectComposer>`: @react-three/postprocessing builds a new composer whenever `multisampling`
 * changes (the quality setting) and never disposes the old one, so its cleanup frees the old composer's two
 * render targets. Not `composer.dispose()`: that also disposes the passes (the shared grade effect among them)
 * and postprocessing's static fullscreen triangle every pass draws with.
 */
export function freeComposerTargets(
  composer: Pick<EffectComposer, 'inputBuffer' | 'outputBuffer'> | null,
): (() => void) | undefined {
  if (!composer) return undefined
  return () => {
    composer.inputBuffer.dispose()
    composer.outputBuffer.dispose()
  }
}
