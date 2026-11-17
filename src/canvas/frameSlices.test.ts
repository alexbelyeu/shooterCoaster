import { describe, expect, it, vi } from 'vitest'
import { chunk, runInFrameSlices } from './frameSlices'

/** A clock each step advances by `stepMs`, and frames run only when `flush` is called. */
function harness(stepMs: number) {
  let t = 0
  const queue: (() => void)[] = []
  return {
    now: () => t,
    tick: () => (t += stepMs),
    nextFrame: (fn: () => void) => void queue.push(fn),
    flush: () => {
      const fn = queue.shift()
      fn?.()
      return fn !== undefined
    },
  }
}

describe('runInFrameSlices', () => {
  it('runs nothing until the next frame, then as many items as fit the budget per frame', () => {
    const h = harness(3)
    const seen: number[][] = []
    const done = vi.fn()
    runInFrameSlices([1, 2, 3, 4, 5, 6, 7], (n) => {
      seen[seen.length - 1].push(n)
      h.tick()
    }, { budgetMs: () => 8, cancelled: () => false, done, now: h.now, nextFrame: h.nextFrame })
    do seen.push([])
    while (h.flush())
    expect(seen.slice(0, -1)).toEqual([[1, 2, 3], [4, 5, 6], [7]])
    expect(done).toHaveBeenCalledTimes(1)
  })

  it('takes one item a frame even when an item alone is over the budget', () => {
    const h = harness(50)
    const frames: number[] = []
    let frame = 0
    runInFrameSlices([1, 2, 3], () => {
      frames.push(frame)
      h.tick()
    }, { budgetMs: () => 8, cancelled: () => false, done: () => {}, now: h.now, nextFrame: (fn) => h.nextFrame(() => { frame++; fn() }) })
    while (h.flush());
    expect(frames).toEqual([1, 2, 3])
  })

  it('stops between items once cancelled and never calls done', () => {
    const h = harness(1)
    let cancelled = false
    const step = vi.fn(() => {
      h.tick()
      cancelled = true
    })
    const done = vi.fn()
    runInFrameSlices([1, 2, 3], step, { budgetMs: () => 100, cancelled: () => cancelled, done, now: h.now, nextFrame: h.nextFrame })
    while (h.flush());
    expect(step).toHaveBeenCalledTimes(1)
    expect(done).not.toHaveBeenCalled()
  })

  it('calls done on the next frame for no items', () => {
    const h = harness(1)
    const done = vi.fn()
    runInFrameSlices([], () => {}, { budgetMs: () => 8, cancelled: () => false, done, now: h.now, nextFrame: h.nextFrame })
    expect(done).not.toHaveBeenCalled()
    h.flush()
    expect(done).toHaveBeenCalledTimes(1)
  })

  it('tells the budget how long the rest of the previous frame took', () => {
    const h = harness(3)
    const asked: number[] = []
    runInFrameSlices([1, 2, 3], () => h.tick(), {
      budgetMs: (rest) => {
        asked.push(rest)
        return 0
      },
      cancelled: () => false,
      done: () => {},
      now: h.now,
      nextFrame: (fn) => h.nextFrame(() => {
        for (let i = 0; i < 10; i++) h.tick() // 30 ms of someone else's frame
        fn()
      }),
    })
    while (h.flush());
    expect(asked).toEqual([0, 30, 30])
  })

  it('asks for the budget every frame', () => {
    const h = harness(3)
    let budget = 8
    const seen: number[][] = []
    runInFrameSlices([1, 2, 3, 4, 5, 6, 7], (n) => {
      seen[seen.length - 1].push(n)
      h.tick()
    }, { budgetMs: () => budget, cancelled: () => false, done: () => {}, now: h.now, nextFrame: h.nextFrame })
    seen.push([])
    h.flush()
    budget = Infinity
    seen.push([])
    h.flush()
    expect(seen).toEqual([[1, 2, 3], [4, 5, 6, 7]])
  })
})

describe('chunk', () => {
  it('splits in order with a short last run', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 3)).toEqual([])
  })
})
