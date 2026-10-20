import { describe, it, expect } from 'vitest'
import { nextTriggerTime, MIN_TRIGGER_GAP } from './triggerTime'

describe('nextTriggerTime', () => {
  it('passes a future time through on first use', () => {
    expect(nextTriggerTime({}, 1.5, 1)).toBe(1.5)
  })

  it('clamps a late time up to the current audio time', () => {
    expect(nextTriggerTime({}, 0.5, 1)).toBe(1)
  })

  it('keeps one node strictly increasing for equal or late times', () => {
    const synth = {}
    const a = nextTriggerTime(synth, 2, 2)
    const b = nextTriggerTime(synth, 2, 2)
    const c = nextTriggerTime(synth, 1.9, 2)
    expect(b).toBeCloseTo(a + MIN_TRIGGER_GAP, 9)
    expect(c).toBeCloseTo(b + MIN_TRIGGER_GAP, 9)
  })

  it('tracks nodes independently', () => {
    const x = {}
    const y = {}
    nextTriggerTime(x, 3, 3)
    expect(nextTriggerTime(y, 3, 3)).toBe(3)
  })

  it('leaves well-spaced times unchanged', () => {
    const synth = {}
    expect(nextTriggerTime(synth, 1, 0)).toBe(1)
    expect(nextTriggerTime(synth, 1.25, 0)).toBe(1.25)
  })
})
