import { describe, expect, it } from 'vitest'
import { ENTRY_SECONDS_MAX, RUN_SECONDS, paceLevel, pacingTimes } from './pacing'

const balloons = (n: number, weight?: number) => ({ type: 'balloon' as const, count: n, ...(weight ? { weight } : {}) })

describe('pacingTimes', () => {
  it('a 60 s run: boss at 40 s, waves over 45 s, the last one in by 33 s and shootable by 35 s', () => {
    expect(RUN_SECONDS).toBe(60)
    expect(pacingTimes()).toEqual({ bossAt: 40, waveSpan: 45, lastWaveBy: 33 })
    expect(pacingTimes().lastWaveBy + ENTRY_SECONDS_MAX).toBeLessThanOrEqual(35)
  })

  it('scales with the run length', () => {
    expect(pacingTimes(90)).toEqual({ bossAt: 60, waveSpan: 67.5, lastWaveBy: 49 })
  })
})

describe('paceLevel', () => {
  it('spreads equal waves over the wave span, the first at 0, and brings the boss in at 40 s', () => {
    const paced = paceLevel({ waves: [balloons(10), balloons(10), balloons(10)], boss: 'goldenBlimp' })
    expect(paced.enemies.map((w) => w.spawnDelay)).toEqual([0, 15, 30])
    expect(paced.boss).toEqual({ type: 'goldenBlimp', at: 40 })
  })

  it('a wave holds the run for its share of the weights; times are whole seconds', () => {
    const paced = paceLevel({ waves: [balloons(1, 3), balloons(1, 2), balloons(1, 2), balloons(1, 3)] })
    expect(paced.enemies.map((w) => w.spawnDelay)).toEqual([0, 14, 23, 32])
    expect(paced.boss).toBeUndefined()
  })

  it('keeps every wave field but the weight', () => {
    const [wave] = paceLevel({ waves: [{ type: 'crow', count: 5, waveLabel: 'Crows!', formation: 'v', weight: 2 }] }).enemies
    expect(wave).toEqual({ type: 'crow', count: 5, waveLabel: 'Crows!', formation: 'v', spawnDelay: 0 })
  })

  it('a finale wave stands in for a missing boss at its time', () => {
    const paced = paceLevel({ waves: [balloons(1), balloons(1, 2)], finale: { type: 'infernalDrake', count: 4 } })
    expect(paced.enemies.map((w) => [w.type, w.spawnDelay])).toEqual([['balloon', 0], ['balloon', 15], ['infernalDrake', 40]])
  })

  it('refuses a last wave too late to be shot before the boss, an empty roster, a bad weight, a boss and a finale', () => {
    expect(() => paceLevel({ waves: [balloons(1), balloons(1), balloons(1), balloons(1)] })).toThrow(/after 33 s/)
    expect(() => paceLevel({ waves: [] })).toThrow()
    expect(() => paceLevel({ waves: [balloons(1, -1)] })).toThrow(/positive/)
    expect(() => paceLevel({ waves: [balloons(1)], boss: 'kraken', finale: { type: 'crow', count: 1 } })).toThrow(/not both/)
  })
})
