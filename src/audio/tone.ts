import type * as ToneLib from './toneLib'

/** Tone.js's chunk, loaded on the first gesture: main-chunk code imports its types only and calls `tone()` once `isAudioReady()`. */
export type ToneModule = typeof ToneLib

let mod: ToneModule | null = null
let loading: Promise<ToneModule> | null = null
let gestureContext: AudioContext | null = null

/** Synchronous, so it runs inside the gesture handler: iOS Safari starts a context only there, and Tone lands after an await. */
export function unlockAudioContext(): void {
  if (!gestureContext && typeof AudioContext !== 'undefined') gestureContext = new AudioContext({ latencyHint: 'interactive' })
  if (gestureContext && gestureContext.state !== 'running') gestureContext.resume().catch(() => {})
}

/** Tone builds a default context at import; `setContext` closes it for the gesture's one. */
export function loadTone(): Promise<ToneModule> {
  unlockAudioContext()
  loading ??= import('./toneLib')
    .then((m) => {
      if (gestureContext) m.setContext(gestureContext, true)
      mod = m
      return m
    })
    .catch((e: unknown) => {
      loading = null
      throw e
    })
  return loading
}

export function tone(): ToneModule {
  if (!mod) throw new Error('Tone.js used before the first gesture loaded it')
  return mod
}

export function toneLoaded(): boolean {
  return mod !== null
}
