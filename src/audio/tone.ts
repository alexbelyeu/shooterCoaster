import type * as ToneLib from './toneLib'

/** Tone.js's chunk, loaded on the first gesture: main-chunk code imports its types only and calls `tone()` once `isAudioReady()`. */
export type ToneModule = typeof ToneLib

let mod: ToneModule | null = null
let loading: Promise<ToneModule> | null = null
let gestureContext: AudioContext | null = null

function resumeGestureContext(): void {
  if (gestureContext && gestureContext.state !== 'running') gestureContext.resume().catch(() => {})
}

/**
 * Creates the page's AudioContext, or resumes it, synchronously: call it from every gesture handler that wants sound.
 * iOS Safari starts a context only inside a gesture (a touch `pointerdown` doesn't count, the `click` after it does),
 * and Tone lands after an await, so each gesture must resume it here, not just the first.
 */
export function unlockAudioContext(): void {
  if (!gestureContext && typeof AudioContext !== 'undefined') {
    gestureContext = new AudioContext({ latencyHint: 'interactive' })
    // iOS Safari interrupts the context when the tab or portal frame is hidden and resumes it only from a touchend / click.
    window.addEventListener('touchend', resumeGestureContext, { capture: true, passive: true })
    window.addEventListener('click', resumeGestureContext, { capture: true })
  }
  resumeGestureContext()
}

/** Loads the chunk only; it never creates or unlocks a context (offline renders load it before any gesture). */
export function loadTone(): Promise<ToneModule> {
  loading ??= import('./toneLib')
    .then((m) => {
      mod = m
      return m
    })
    .catch((e: unknown) => {
      loading = null
      throw e
    })
  return loading
}

/** Hands Tone the gesture's context; `setContext` closes the default one Tone built at import. */
export function adoptGestureContext(m: ToneModule): void {
  if (gestureContext && m.getContext().rawContext !== gestureContext) m.setContext(gestureContext, true)
}

export function tone(): ToneModule {
  if (!mod) throw new Error('Tone.js used before the first gesture loaded it')
  return mod
}

export function toneLoaded(): boolean {
  return mod !== null
}
