import { swapInOfflineContext } from './AudioEngine'
import { createRng } from '@/utils/rng'

export interface OfflineRenderScope {
  /** Runs `fn` at `t` seconds of render time, with `audioNow()` there. */
  at: (t: number, fn: () => void) => void
}

/**
 * Renders the game's own music / SFX code faster than real time: the script's `at` callbacks run in time order on a
 * scripted clock, scheduling into an OfflineAudioContext that then renders it all. The engines build in that context
 * until it resolves, so call it only while no live audio plays.
 */
export async function renderOffline(
  { seconds, sampleRate = 44100, seed = 1 }: { seconds: number; sampleRate?: number; seed?: number },
  script: (scope: OfflineRenderScope) => void,
  cleanup: () => void,
): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate)
  let now = 0
  /** Sorted by time; a callback at the same time as another runs after it. */
  const queue: { t: number; fn: () => void }[] = []
  const at = (t: number, fn: () => void) => {
    let i = queue.length
    while (i > 0 && queue[i - 1].t > t) i--
    queue.splice(i, 0, { t: Math.max(t, now), fn })
  }
  const random = Math.random
  const restore = swapInOfflineContext(ctx, () => now)
  Math.random = createRng(seed)
  try {
    script({ at })
    for (let next = queue.shift(); next; next = queue.shift()) {
      now = next.t
      next.fn()
    }
    return await ctx.startRendering()
  } finally {
    try {
      cleanup()
    } finally {
      Math.random = random
      restore()
    }
  }
}
