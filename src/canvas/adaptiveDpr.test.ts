import { describe, expect, it } from 'vitest'
import {
  adaptiveBudgetScale,
  adaptiveDprTick,
  BUDGET_STEP,
  createAdaptiveDpr,
  MAX_STEPS,
  SETTLE_S,
  SLOW_FOR_S,
  SLOW_FRAME_MS,
  STALL_MS,
} from './adaptiveDpr'

/** Feed `seconds` of frames of `ms` each; returns how many steps they caused. */
function feed(state: ReturnType<typeof createAdaptiveDpr>, ms: number, seconds: number): number {
  let stepped = 0
  for (let t = 0; t < seconds * 1000; t += ms) if (adaptiveDprTick(state, ms)) stepped += 1
  return stepped
}

describe('adaptiveDprTick', () => {
  it('leaves a smooth game alone', () => {
    const s = createAdaptiveDpr()
    expect(feed(s, 16.7, 60)).toBe(0)
    expect(s.steps).toBe(0)
  })

  it('steps down after SLOW_FOR_S of slow frames, not before', () => {
    const s = createAdaptiveDpr()
    expect(feed(s, 30, SLOW_FOR_S - 0.3)).toBe(0)
    expect(feed(s, 30, 0.6)).toBe(1)
    expect(s.steps).toBe(1)
  })

  it('a few fast frames reset the count, single fast frames do not', () => {
    const s = createAdaptiveDpr()
    feed(s, 30, SLOW_FOR_S - 0.3)
    feed(s, 10, 0.5)
    expect(feed(s, 30, SLOW_FOR_S - 0.3)).toBe(0)
    const t = createAdaptiveDpr()
    feed(t, 30, 1)
    adaptiveDprTick(t, 10)
    expect(feed(t, 30, 1.2)).toBe(1)
  })

  it('waits SETTLE_S after a step before counting again', () => {
    const s = createAdaptiveDpr()
    feed(s, 40, SLOW_FOR_S + 0.1)
    expect(s.steps).toBe(1)
    expect(feed(s, 40, SETTLE_S + SLOW_FOR_S - 0.3)).toBe(0)
    expect(feed(s, 40, 0.6)).toBe(1)
  })

  it('ignores stalls and never steps past MAX_STEPS or back up', () => {
    const s = createAdaptiveDpr()
    expect(feed(s, STALL_MS + 1, 30)).toBe(0)
    feed(s, SLOW_FRAME_MS * 3, 60)
    expect(s.steps).toBe(MAX_STEPS)
    feed(s, 5, 60)
    expect(s.steps).toBe(MAX_STEPS)
  })

  it('carries on from steps already taken', () => {
    expect(createAdaptiveDpr(2).steps).toBe(2)
  })
})

describe('adaptiveBudgetScale', () => {
  it('multiplies the budget by BUDGET_STEP per step, clamped', () => {
    expect(adaptiveBudgetScale(0)).toBe(1)
    expect(adaptiveBudgetScale(2)).toBeCloseTo(BUDGET_STEP ** 2, 10)
    expect(adaptiveBudgetScale(99)).toBeCloseTo(BUDGET_STEP ** MAX_STEPS, 10)
    expect(adaptiveBudgetScale(-1)).toBe(1)
  })
})
