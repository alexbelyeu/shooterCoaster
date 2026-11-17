/** Work spread over animation frames (#597): the shader warm-up's compiles and draws never make one long frame. */

export interface SliceOptions {
  /**
   * Each frame takes one item, then more until this much time has gone; asked each frame with the time the rest of
   * the previous frame took (between its slice and this one), 0 on the first.
   */
  budgetMs: (restOfFrameMs: number) => number
  cancelled: () => boolean
  done: () => void
  now?: () => number
  nextFrame?: (fn: () => void) => void
}

/** Runs `step` on every item in order, a slice a frame, starting on the next frame; `done` after the last (never once cancelled). */
export function runInFrameSlices<T>(items: readonly T[], step: (item: T) => void, opts: SliceOptions): void {
  const now = opts.now ?? (() => performance.now())
  const nextFrame = opts.nextFrame ?? ((fn) => void requestAnimationFrame(fn))
  let i = 0
  let prevEnd: number | null = null
  const slice = () => {
    if (opts.cancelled()) return
    const start = now()
    const until = start + opts.budgetMs(prevEnd === null ? 0 : start - prevEnd)
    do {
      if (i >= items.length) break
      step(items[i++])
    } while (now() < until && !opts.cancelled())
    prevEnd = now()
    if (opts.cancelled()) return
    if (i >= items.length) opts.done()
    else nextFrame(slice)
  }
  nextFrame(slice)
}

/** `items` in runs of `size`, in order. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
