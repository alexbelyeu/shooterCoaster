import { describe, expect, it } from 'vitest'
import { DAILY_LEVELS as GAME_DAILY_LEVELS, dailyKey, dailyLevel } from '@/levels/daily'
import { DAILY_LEVELS, dailyError, dayLevel, isDayKey } from './daily'

const NOW = Date.UTC(2026, 10, 23, 0, 30)

describe('api daily rules', () => {
  it("match the game's daily rotation", () => {
    expect(DAILY_LEVELS).toEqual(GAME_DAILY_LEVELS)
    const keys = Array.from({ length: 400 }, (_, d) => dailyKey(new Date(NOW + d * 86_400_000)))
    expect(keys.map(dayLevel)).toEqual(keys.map((k) => dailyLevel(k)))
  })

  it('take only real YYYY-MM-DD dates', () => {
    for (const ok of ['2026-11-23', '2024-02-29']) expect(isDayKey(ok)).toBe(true)
    for (const bad of ['2026-11-31', '2025-02-29', '2026-1-23', '2026-11-23T00:00', 20261123, null]) expect(isDayKey(bad)).toBe(false)
  })

  it("take today's and yesterday's daily on its own level only", () => {
    expect(dailyError('2026-11-23', dayLevel('2026-11-23'), NOW)).toBeNull()
    expect(dailyError('2026-11-22', dayLevel('2026-11-22'), NOW)).toBeNull()
    expect(dailyError('2026-11-21', dayLevel('2026-11-21'), NOW)).toBe('daily closed')
    expect(dailyError('2026-11-24', dayLevel('2026-11-24'), NOW)).toBe('daily closed')
    const other = DAILY_LEVELS.find((l) => l !== dayLevel('2026-11-23'))!
    expect(dailyError('2026-11-23', other, NOW)).toBe("not that day's level")
    expect(dailyError('2026-11-23', 'level5', NOW)).toBe("not that day's level")
    expect(dailyError('nope', 'level1', NOW)).toBe('bad daily')
  })
})
