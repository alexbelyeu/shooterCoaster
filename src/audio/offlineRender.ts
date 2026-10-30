import * as Tone from 'tone'
import { swapInOfflineChain } from './AudioEngine'
import { createRng } from '@/utils/rng'

/** Same look-ahead as Tone's live context, so loop callbacks and `Tone.now()` see what they see in the game. */
const LOOK_AHEAD_S = 0.1

/**
 * Tone's OfflineContext has no look-ahead: its loop callbacks fire after their own time
 * and `nextTriggerTime` would push every note late. This one runs ahead like the live
 * context, so a note lands on the sample it was scheduled for.
 */
class LookAheadOfflineContext extends Tone.OfflineContext {
  now(): number {
    return super.now() + LOOK_AHEAD_S
  }
}

export interface OfflineRenderOptions {
  seconds: number
  sampleRate?: number
  /** Seeds `Math.random` (fire jitter, title chimes) for the render, so two renders match. */
  seed?: number
}

/** What a render script gets: `at(t, fn)` runs `fn` at `t` seconds of render time, with `Tone.now()` there. */
export interface OfflineRenderScope {
  at: (t: number, fn: () => void) => void
}

/**
 * Renders the game's own audio code faster than real time: `script` starts music and
 * schedules SFX calls with `at`, all against a fresh master chain (`swapInOfflineChain`)
 * inside an offline Tone context. `cleanup` runs before the live context comes back
 * (stop music, dispose the kit). Call it only while no live audio is playing (the
 * title screen before audio unlocks): for the length of the render, Tone's global
 * context is the offline one.
 */
export async function renderOffline(
  { seconds, sampleRate = 44100, seed = 1 }: OfflineRenderOptions,
  script: (scope: OfflineRenderScope) => void,
  cleanup: () => void,
): Promise<AudioBuffer> {
  const live = Tone.getContext()
  const offline = new LookAheadOfflineContext(2, seconds, sampleRate)
  const random = Math.random
  Tone.setContext(offline)
  const restoreChain = swapInOfflineChain()
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
