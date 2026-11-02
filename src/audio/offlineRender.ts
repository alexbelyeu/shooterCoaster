import * as Tone from 'tone'
import { swapInOfflineChain } from './AudioEngine'
import { loadTone } from './tone'
import { createRng } from '@/utils/rng'
import type { MusicEngine } from './musicEngine'

const LOOK_AHEAD_S = 0.1

/** Tone's OfflineContext has no look-ahead, so `nextTriggerTime` would push every loop note late; this one runs ahead like the live context. */
class LookAheadOfflineContext extends Tone.OfflineContext {
  now(): number {
    return super.now() + LOOK_AHEAD_S
  }
}

export interface OfflineRenderScope {
  /** Runs `fn` at `t` seconds of render time, with `Tone.now()` there. */
  at: (t: number, fn: () => void) => void
}

/**
 * Renders the game's own music / SFX code faster than real time. Tone's global context is
 * the offline one until it resolves, so call it only while no live audio plays.
 */
export async function renderOffline(
  { seconds, sampleRate = 44100, seed = 1, engine = 'tone' }: { seconds: number; sampleRate?: number; seed?: number; engine?: MusicEngine },
  script: (scope: OfflineRenderScope) => void,
  cleanup: () => void,
): Promise<AudioBuffer> {
  await loadTone()
  const live = Tone.getContext()
  const offline = new LookAheadOfflineContext(2, seconds, sampleRate)
  const random = Math.random
  Tone.setContext(offline)
  const restoreChain = swapInOfflineChain(engine)
  Math.random = createRng(seed)
  try {
    script({ at: (t, fn) => offline.setTimeout(fn, t - LOOK_AHEAD_S) })
    // Synchronous clock: every scheduled callback runs in this turn, before the page can touch Tone.
    const buffer = await offline.render(false)
    return buffer.get() as AudioBuffer
  } finally {
    try {
      cleanup()
    } finally {
      Math.random = random
      restoreChain()
      Tone.setContext(live)
      offline.dispose()
    }
  }
}
