import { describe, expect, it } from 'vitest'
import { RUN_SECONDS, paceLevel, pacingTimes } from './pacing'
import { ENTRY_SECONDS_MAX } from '@/entities/spawning/spawnPlacement'

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

  it('times a hard-route branch wave at its own second, last, leaving the weighted waves as they were (#720)', () => {
    const plain = paceLevel({ waves: [balloons(1), balloons(1, 2)], boss: 'kraken' })
    const paced = paceLevel({ waves: [balloons(1), balloons(1, 2)], boss: 'kraken', branch: { type: 'crow', count: 6, at: 19 } })
    expect(paced.enemies.slice(0, -1)).toEqual(plain.enemies)
    expect(paced.enemies[paced.enemies.length - 1]).toEqual({ type: 'crow', count: 6, route: 'hard', spawnDelay: 19 })
    expect(() => paceLevel({ waves: [balloons(1)], boss: 'kraken', branch: { type: 'crow', count: 1, at: 19.5 } })).toThrow(/whole second/)
    expect(() => paceLevel({ waves: [balloons(1)], boss: 'kraken', branch: { type: 'crow', count: 1, at: 40 } })).toThrow(/before 40 s/)
  })

  it('brings the boss in at its own second when the roster gives one, after the last wave (#1059)', () => {
    expect(paceLevel({ waves: [balloons(1), balloons(1)], boss: 'kraken', bossAt: 38 }).boss).toEqual({ type: 'kraken', at: 38 })
    expect(() => paceLevel({ waves: [balloons(1), balloons(1)], boss: 'kraken', bossAt: 22 })).toThrow(/after the last wave/)
    expect(() => paceLevel({ waves: [balloons(1)], boss: 'kraken', bossAt: 38.5 })).toThrow(/whole second/)
  })

  it('times fight waves at their own seconds, after the weighted waves (#1059)', () => {
    const plain = paceLevel({ waves: [balloons(1), balloons(1)], boss: 'kraken' })
    const paced = paceLevel({ waves: [balloons(1), balloons(1)], boss: 'kraken', fight: [{ type: 'crow', count: 6, at: 44 }] })
    expect(paced.enemies.slice(0, -1)).toEqual(plain.enemies)
    expect(paced.enemies[paced.enemies.length - 1]).toEqual({ type: 'crow', count: 6, spawnDelay: 44 })
  })

  it('refuses a last wave too late to be shot before the boss, an empty roster, a bad weight, a boss and a finale', () => {
    expect(() => paceLevel({ waves: [balloons(1), balloons(1), balloons(1), balloons(1)] })).toThrow(/after 33 s/)
    expect(() => paceLevel({ waves: [] })).toThrow()
    expect(() => paceLevel({ waves: [balloons(1, -1)] })).toThrow(/positive/)
    expect(() => paceLevel({ waves: [balloons(1)], boss: 'kraken', finale: { type: 'crow', count: 1 } })).toThrow(/not both/)
  })
})
