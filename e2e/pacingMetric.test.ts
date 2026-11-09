import { describe, expect, it } from 'vitest'
import { pacingBudgetProblems, pacingMetrics, pacingSummary, pacingTimeline } from './pacingMetric.mjs'

/** One sample per `step` s from 0 to `end`, `targets(t)` on screen, track = t / end. */
function ride(end: number, targets: (t: number) => number, step = 0.5, flags: (t: number) => object = () => ({})) {
  const samples = []
  for (let t = 0; t < end; t += step) samples.push({ t, targets: targets(t), track: t / end, ...flags(t) })
  return samples
}

describe('pacingMetrics', () => {
  it('counts no empty time when a target is always on screen', () => {
    const m = pacingMetrics(ride(60, () => 2), 60)
    expect(m).toMatchObject({ runSeconds: 60, countedSeconds: 58, noTargetShare: 0, longestGapSeconds: 0, longestGap: null, gaps: [] })
  })

  it('measures the share of counted time with nothing on screen and the longest gap', () => {
    // Empty 10–17 s and 30–33 s.
    const m = pacingMetrics(ride(60, (t) => ((t >= 10 && t < 17) || (t >= 30 && t < 33) ? 0 : 1)), 60)
    expect(m.noTargetShare).toBeCloseTo(10 / 58, 3)
    expect(m.longestGap).toEqual({ start: 10, seconds: 7, track: 0.167 })
    expect(m.gaps.map((g: { start: number }) => g.start)).toEqual([10, 30])
  })

  it('leaves the first 2 s after GO out', () => {
    const m = pacingMetrics(ride(20, (t) => (t < 5 ? 0 : 1)), 20)
    expect(m.countedSeconds).toBe(18)
    expect(m.longestGap).toMatchObject({ start: 2, seconds: 3 })
  })

  it('splits a sample that straddles the end of the grace', () => {
    const m = pacingMetrics([{ t: 0, targets: 0, track: 0 }, { t: 1.5, targets: 0, track: 0.1 }, { t: 3, targets: 1, track: 0.2 }], 4)
    expect(m.countedSeconds).toBe(2)
    expect(m.longestGap).toMatchObject({ start: 2, seconds: 1, track: 0.1 })
  })

  it('leaves the boss tell out, and it ends a gap', () => {
    // Empty from 40 s to the end; the tell is 45–48 s.
    const m = pacingMetrics(ride(60, (t) => (t >= 40 ? 0 : 1), 0.5, (t) => ({ bossTell: t >= 45 && t < 48 })), 60)
    expect(m.countedSeconds).toBe(55)
    expect(m.gaps.map((g: { start: number; seconds: number }) => [g.start, g.seconds])).toEqual([[40, 5], [48, 12]])
    expect(m.longestGapSeconds).toBe(12)
  })

  it('counts a wave tell like any other time', () => {
    const m = pacingMetrics(ride(20, (t) => (t >= 10 ? 0 : 1), 0.5, (t) => ({ waveTell: t >= 12 && t < 13 })), 20)
    expect(m.longestGapSeconds).toBe(10)
  })

  it('ends the last sample at the run end and lists only gaps of 1 s or more', () => {
    const m = pacingMetrics([
      { t: 0, targets: 1, track: 0 }, { t: 5, targets: 0, track: 0.1 }, { t: 5.5, targets: 1, track: 0.11 },
      { t: 9, targets: 0, track: 0.2 },
    ], 12)
    expect(m.longestGap).toMatchObject({ start: 9, seconds: 3 })
    expect(m.gaps).toHaveLength(1)
  })

  it('handles uneven frames (a slow frame stands for its whole step)', () => {
    const m = pacingMetrics([{ t: 0, targets: 1, track: 0 }, { t: 4, targets: 0, track: 0.3 }, { t: 4.25, targets: 0, track: 0.31 }, { t: 9, targets: 2, track: 0.6 }], 10)
    expect(m.longestGap).toMatchObject({ start: 4, seconds: 5 })
    expect(m.noTargetShare).toBeCloseTo(5 / 8, 3)
  })

  it('reports nothing for an empty sample list', () => {
    expect(pacingMetrics([], 60)).toMatchObject({ countedSeconds: 0, noTargetShare: 0, longestGap: null })
  })
})

describe('pacingTimeline', () => {
  it('has one row a level second with the fewest and most targets and the tell flags', () => {
    const rows = pacingTimeline(ride(3, (t) => (t === 1.5 ? 0 : 3), 0.5, (t) => ({ waveTell: t === 2.5 })))
    expect(rows).toEqual([
      { t: 0, min: 3, max: 3, track: 0, waveTell: false, bossTell: false },
      { t: 1, min: 0, max: 3, track: 0.333, waveTell: false, bossTell: false },
      { t: 2, min: 3, max: 3, track: 0.667, waveTell: true, bossTell: false },
    ])
  })
})

describe('pacing summary and budget', () => {
  const m = pacingMetrics(ride(60, (t) => (t >= 31 && t < 38.5 ? 0 : 1)), 60)

  it('prints one line per level', () => {
    expect(pacingSummary('level2', m)).toBe('level2 pacing: no target 13% of 60 s, longest gap 7.5 s at 31 s (track 0.52)')
  })

  it('fails a level over its ceilings with a line that names the gap', () => {
    expect(pacingBudgetProblems('level2', m, { longestGapSeconds: 8, noTargetShare: 0.2 })).toEqual([])
    expect(pacingBudgetProblems('level2', m, { longestGapSeconds: 3, noTargetShare: 0.1 })).toEqual([
      'longest gap 7.5 s at 31.0 s (track 0.52) over budget 3 s',
      'no target 13% of the run over budget 10%',
    ])
    expect(pacingBudgetProblems('level9', m, undefined)).toEqual(['no pacing budget for level9 in budgets.json'])
  })
})
