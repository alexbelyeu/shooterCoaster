import { describe, expect, it } from 'vitest'
import { accuracyPercent, bulbRing, bulbStar, counterWheels, formatAccuracy, formatBestCombo, isNewRecord, nextStarLine, runLines, type RunLineInput } from './resultsStats'

describe('accuracy', () => {
  it('is hits / shots as a whole percent', () => {
    expect(accuracyPercent(1, 3)).toBe(33)
    expect(accuracyPercent(2, 3)).toBe(67)
    expect(formatAccuracy(5, 10)).toBe('50%')
  })

  it('never NaN: no shots reads as a dash', () => {
    expect(accuracyPercent(0, 0)).toBeNull()
    expect(formatAccuracy(0, 0)).toBe('—')
    expect(formatAccuracy(3, 0)).toBe('—')
  })

  it('caps at 100% (one shot can resolve several hits in the e2e hook)', () => {
    expect(formatAccuracy(5, 1)).toBe('100%')
  })
})

describe('formatBestCombo', () => {
  it('is the multiplier sign, or a dash without a combo', () => {
    expect(formatBestCombo(14)).toBe('×14')
    expect(formatBestCombo(0)).toBe('—')
  })
})

describe('isNewRecord', () => {
  it('needs a non-zero score above the previous best', () => {
    expect(isNewRecord(100, 0)).toBe(true)
    expect(isNewRecord(100, 99)).toBe(true)
    expect(isNewRecord(100, 100)).toBe(false)
    expect(isNewRecord(0, 0)).toBe(false)
  })
})

const RUN: RunLineInput = { kills: 12, totalEnemies: 86, hits: 16, shotsFired: 25, bestCombo: 3, timeRemaining: 49.2, bystanders: null }
const text = (run: RunLineInput) => runLines(run).map((l) => `${l.stat}=${l.text}`)

describe('runLines', () => {
  it("says the run in the showman's voice", () => {
    expect(text(RUN)).toEqual(['hits=12 of 86 hit', 'accuracy=64% of shots on target', 'combo=Best combo ×3', 'time=50 seconds to spare'])
  })

  it('has a line for no shots, no combo, one second and none left', () => {
    const lines = text({ ...RUN, shotsFired: 0, bestCombo: 0, timeRemaining: 0.4 })
    expect(lines).toEqual(['hits=12 of 86 hit', 'accuracy=Not a shot fired', 'combo=No combo this time', 'time=1 second to spare'])
    expect(text({ ...RUN, timeRemaining: -0.2 })[3]).toBe('time=Down to the wire')
  })

  it('counts the spared before the time, only on a level with bystanders', () => {
    expect(text({ ...RUN, bystanders: { noun: 'climbers', total: 10, hit: 3 } })[3]).toBe('spared=7 of 10 climbers spared')
    expect(text({ ...RUN, bystanders: { noun: 'climbers', total: 0, hit: 0 } })).toHaveLength(4)
  })
})

describe('nextStarLine', () => {
  const fmt = (n: number) => n.toLocaleString('en-US')
  it('names the next star and its price, or takes a bow', () => {
    expect(nextStarLine({ stars: 2, points: 1200 }, fmt)).toBe('1,200 more for the second star')
    expect(nextStarLine({ stars: 1, points: 5 }, fmt)).toBe('5 more for the first star')
    expect(nextStarLine(null, fmt)).toBe('All three stars. Take a bow.')
  })
})

describe('counterWheels', () => {
  it('reads the value digit by digit once it stops', () => {
    expect(counterWheels(4093, 4)).toEqual([4, 0, 9, 3])
    expect(counterWheels(0, 1)).toEqual([0])
  })

  it('turns a higher wheel only while every wheel below rolls 9 to 0', () => {
    expect(counterWheels(9.5, 2)).toEqual([0.5, 9.5])
    expect(counterWheels(18.5, 2)).toEqual([1, 8.5])
    const w = counterWheels(99.25, 3)
    expect(w[0]).toBeCloseTo(0.25)
    expect(w[1]).toBeCloseTo(9.25)
    expect(w[2]).toBeCloseTo(9.25)
  })
})

describe('bulbRing', () => {
  it('runs clockwise round the rectangle from its top-left corner', () => {
    const ring = bulbRing(3, 1)
    expect(ring).toEqual([
      { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 100, y: 100 }, { x: 50, y: 100 }, { x: 0, y: 100 },
      { x: 0, y: 50 },
    ])
  })

  it('splits the ring into three equal runs, one per star', () => {
    const runs = [0, 0, 0]
    for (let i = 0; i < 30; i++) runs[bulbStar(i, 30)]++
    expect(runs).toEqual([10, 10, 10])
  })
})
