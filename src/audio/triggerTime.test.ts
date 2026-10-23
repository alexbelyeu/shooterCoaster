import { describe, it, expect } from 'vitest'
import { nextTriggerTime, MIN_TRIGGER_GAP, LATE_MARGIN } from './triggerTime'

/** Tone's Source.start: clamps a past time to the live clock, throws on a non-increasing start. */
function toneSource() {
  let lastStart = -Infinity
  return (time: number, liveCurrentTime: number) => {
    const t = Math.max(time, liveCurrentTime)
    if (!(t > lastStart + 1e-6)) throw new Error('Start time must be strictly greater than previous start time')
    lastStart = t
  }
}

describe('nextTriggerTime', () => {
  it('passes a future time through on first use', () => {
    expect(nextTriggerTime({}, 1.5, 1)).toBe(1.5)
  })

  it('moves a late time just ahead of the current audio time', () => {
    expect(nextTriggerTime({}, 0.5, 1)).toBe(1 + LATE_MARGIN)
    expect(nextTriggerTime({}, 1, 1)).toBe(1 + LATE_MARGIN)
  })

  it('keeps one node strictly increasing for equal or late times', () => {
    const synth = {}
    const a = nextTriggerTime(synth, 2, 1)
    const b = nextTriggerTime(synth, 2, 1)
    const c = nextTriggerTime(synth, 1.9, 1)
    expect(b).toBeCloseTo(a + MIN_TRIGGER_GAP, 9)
    expect(c).toBeCloseTo(b + MIN_TRIGGER_GAP, 9)
  })

  it('tracks nodes independently', () => {
    const x = {}
    const y = {}
    nextTriggerTime(x, 3, 2)
    expect(nextTriggerTime(y, 3, 2)).toBe(3)
  })

  it('leaves well-spaced times unchanged', () => {
    const synth = {}
    expect(nextTriggerTime(synth, 1, 0)).toBe(1)
    expect(nextTriggerTime(synth, 1.25, 0)).toBe(1.25)
  })

  it('never lands on a start Tone clamped to a clock that ticked between our read and its own (#115)', () => {
    const quantum = 128 / 44100
    const synth = {}
    const start = toneSource()
    let clock = 1
    for (let i = 0; i < 50; i++) {
      const t = nextTriggerTime(synth, clock - 0.5, clock)
      if (i % 2 === 0) clock += quantum
      expect(() => start(t, clock)).not.toThrow()
    }
  })
})
