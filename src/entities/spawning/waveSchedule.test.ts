import { describe, expect, it } from 'vitest'
import { getAllLevels } from '@/levels/LevelRegistry'
import { WAVE_TELL_SECONDS, newWaveProgress, tickWaves } from './waveSchedule'

/** Ticks the schedule at each elapsed time; returns the events in order. */
function run(delays: number[], times: number[], progress = newWaveProgress(delays.length)) {
  const events: string[] = []
  for (const t of times) {
    tickWaves(delays, t, progress, (i) => events.push(`tell ${i} @${t}`), (i) => events.push(`arrive ${i} @${t}`))
  }
  return events
}

describe('tickWaves', () => {
  it('tells each delayed wave a second early, then brings it in on time', () => {
    const times = Array.from({ length: 50 }, (_, i) => i)
    expect(run([0, 20, 45], times)).toEqual(['tell 1 @19', 'arrive 1 @20', 'tell 2 @44', 'arrive 2 @45'])
  })

  it('gives waves live from the start no tell and no arrival', () => {
    expect(run([0, 0], [0, 10, 100])).toEqual([])
  })

  it('a pause holds the level time, so resuming continues the schedule without replays (#198)', () => {
    const progress = newWaveProgress(3)
    const before = run([0, 20, 45], [0, 5, 19, 20, 25], progress)
    const after = run([0, 20, 45], [25, 30, 44, 45, 60], progress)
    expect(before).toEqual(['tell 1 @19', 'arrive 1 @20'])
    expect(after).toEqual(['tell 2 @44', 'arrive 2 @45'])
  })

  it('a slow frame past both times still tells before the arrival, on the next tick', () => {
    expect(run([0, 15], [10, 17, 18])).toEqual(['tell 1 @17', 'arrive 1 @18'])
  })

  it('a fresh progress replays the schedule for a new run', () => {
    const times = [0, 14, 15]
    const progress = newWaveProgress(2)
    expect(run([0, 15], times, progress)).toEqual(['tell 1 @14', 'arrive 1 @15'])
    expect(run([0, 15], times, progress)).toEqual([])
    expect(run([0, 15], times)).toEqual(['tell 1 @14', 'arrive 1 @15'])
  })

  it('every level wave is on a whole second and arrives on time within its level timer', () => {
    for (const level of getAllLevels()) {
      const delays = level.enemies.map((w) => w.spawnDelay ?? 0)
      const times = Array.from({ length: level.timerSeconds + 1 }, (_, i) => i)
      const expected = delays.flatMap((d, i) => (d > 0 ? [`tell ${i} @${d - WAVE_TELL_SECONDS}`, `arrive ${i} @${d}`] : []))
      for (const d of delays) expect(Number.isInteger(d), `${level.id} delay ${d}`).toBe(true)
      expect(run(delays, times).sort(), level.id).toEqual(expected.sort())
    }
  })
})
