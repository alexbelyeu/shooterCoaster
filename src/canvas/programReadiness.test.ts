import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { whenProgramsReady } from './programReadiness'

/** Each material's program turns ready after `readyAfter` checks; dispose drops its properties, as three does. */
function fakeRenderer(parallel: boolean) {
  const props = new Map<object, { currentProgram: { isReady(): boolean } }>()
  const add = (readyAfter: number) => {
    const m = {}
    let checks = 0
    props.set(m, { currentProgram: { isReady: () => ++checks > readyAfter } })
    return m
  }
  const gl = {
    properties: { has: (o: object) => props.has(o), get: (o: object) => props.get(o) },
    extensions: { has: (name: string) => parallel && name === 'KHR_parallel_shader_compile' },
  }
  return { gl, add, dispose: (m: object) => props.delete(m) }
}

describe('whenProgramsReady', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('calls done once every program is ready', () => {
    const r = fakeRenderer(true)
    const done = vi.fn()
    whenProgramsReady(r.gl, new Set([r.add(0), r.add(3)]), () => false, done)
    expect(done).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(done).toHaveBeenCalledTimes(1)
  })

  it('waits before the first check without the parallel-compile extension', () => {
    const r = fakeRenderer(false)
    const done = vi.fn()
    whenProgramsReady(r.gl, new Set([r.add(0)]), () => false, done)
    expect(done).not.toHaveBeenCalled()
    vi.advanceTimersByTime(10)
    expect(done).toHaveBeenCalledTimes(1)
  })

  it('stops polling once cancelled and never calls done', () => {
    const r = fakeRenderer(true)
    const done = vi.fn()
    let cancelled = false
    whenProgramsReady(r.gl, new Set([r.add(5)]), () => cancelled, done)
    cancelled = true
    vi.advanceTimersByTime(1000)
    expect(done).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('skips a material disposed mid-compile instead of throwing', () => {
    const r = fakeRenderer(true)
    const slow = r.add(1000)
    const done = vi.fn()
    whenProgramsReady(r.gl, new Set([slow, r.add(0)]), () => false, done)
    r.dispose(slow)
    expect(() => vi.advanceTimersByTime(20)).not.toThrow()
    expect(done).toHaveBeenCalledTimes(1)
  })
})
