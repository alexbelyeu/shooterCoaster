import { describe, expect, it } from 'vitest'
import { growthMoments, programGateProblem, throttleReport } from './slowPass.mjs'

const moment = (added: number, levelTime: number, events: string[] = []) => ({ added, levelTime, phase: 'playing', events })

describe('programGateProblem (#539)', () => {
  it('passes a run that compiled nothing after the warm-up', () => {
    expect(programGateProblem({ warmup: 40, added: 0, moments: [] })).toBeNull()
    expect(programGateProblem(null)).toBeNull()
  })

  it('fails one that did, naming the moments the programs appeared', () => {
    const p = programGateProblem({ warmup: 40, added: 3, moments: [moment(2, 12.34, ['kill:crow']), moment(1, 40)] })
    expect(p).toMatch(/^programs after warm-up: \+3/)
    expect(p).toContain('+2 at 12.3 s playing (kill:crow); +1 at 40.0 s playing')
  })
})

describe('growthMoments', () => {
  it('shows the first six moments and counts the rest', () => {
    const s = growthMoments({ added: 8, moments: Array.from({ length: 8 }, (_, i) => moment(1, i)) })
    expect(s.match(/\+1 at/g)).toHaveLength(6)
    expect(s).toMatch(/; 2 more\]$/)
    expect(growthMoments({ added: 0, moments: [] })).toBe('')
  })
})

describe('throttleReport', () => {
  it('keeps the throttled levels only, with their frame and program numbers', () => {
    const report = throttleReport(4, [
      { id: 'level1', throttled: { rate: 4, maxMs: 3002.4, count: 73 }, shaders: { added: 0 } },
      { id: 'quality' },
      { id: 'level3', throttled: { rate: 4, maxMs: 4145, count: 65 }, shaders: { added: 2 } },
    ])
    expect(report).toEqual({
      rate: 4,
      levels: {
        level1: { maxFrameMs: 3002, longFrames: 73, programsAfterWarmup: 0 },
        level3: { maxFrameMs: 4145, longFrames: 65, programsAfterWarmup: 2 },
      },
    })
  })
})
