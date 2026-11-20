import { describe, expect, it } from 'vitest'
import { getAllLevels } from '@/levels/LevelRegistry'
import { ATMOSPHERES } from '@/levels/environments/atmosphere'
import { maxWeatherStreaks, WEATHER_LOOKS, WEATHER_RAMP, weatherEnvelope, weatherFog } from './weatherPulse'

const SECONDS = 7

describe('weatherEnvelope', () => {
  it('is 0 before the wave, 1 through the hold and 0 after', () => {
    expect(weatherEnvelope(SECONDS, Number.NaN)).toBe(0)
    expect(weatherEnvelope(SECONDS, -1)).toBe(0)
    expect(weatherEnvelope(SECONDS, 0)).toBe(0)
    expect(weatherEnvelope(SECONDS, WEATHER_RAMP.inS)).toBe(1)
    expect(weatherEnvelope(SECONDS, SECONDS - WEATHER_RAMP.outS)).toBe(1)
    expect(weatherEnvelope(SECONDS, SECONDS)).toBe(0)
    expect(weatherEnvelope(SECONDS, 60)).toBe(0)
  })

  it('ramps in and out monotonically, within 0..1', () => {
    const samples = Array.from({ length: 701 }, (_, i) => weatherEnvelope(SECONDS, i / 100))
    const peak = SECONDS - WEATHER_RAMP.outS
    const rising = samples.slice(0, WEATHER_RAMP.inS * 100 + 1)
    const falling = samples.slice(peak * 100)
    expect(rising.every((v, i) => i === 0 || v >= rising[i - 1])).toBe(true)
    expect(falling.every((v, i) => i === 0 || v <= falling[i - 1])).toBe(true)
    expect(samples.every((v) => v >= 0 && v <= 1)).toBe(true)
  })
})

describe('weatherFog', () => {
  const base = ATMOSPHERES.desert
  const look = WEATHER_LOOKS.sandstorm

  it("returns to the biome's own fog exactly once the pulse has cleared", () => {
    const out = { near: 0, far: 0 }
    for (const elapsed of [0.5, 2, 6.5]) weatherFog(base, look, weatherEnvelope(SECONDS, elapsed), out)
    weatherFog(base, look, weatherEnvelope(SECONDS, SECONDS + 0.1), out)
    expect(out).toEqual({ near: base.fogNear, far: base.fogFar })
  })

  it('closes in at the hold, never past the near plane', () => {
    const out = weatherFog(base, look, 1, { near: 0, far: 0 })
    expect(out.near).toBeCloseTo(base.fogNear * look.fogNear)
    expect(out.far).toBeCloseTo(base.fogFar * look.fogFar)
    expect(out.far).toBeGreaterThan(out.near)
  })
})

describe('weather looks', () => {
  it.each(Object.entries(WEATHER_LOOKS))('%s stays readable: a modest fog and a bounded streak count', (_, look) => {
    expect(look.fogFar).toBeGreaterThanOrEqual(0.25)
    expect(look.fogNear).toBeGreaterThanOrEqual(0.25)
    expect(look.streaks).toBeLessThanOrEqual(2000)
    expect(look.opacity).toBeLessThanOrEqual(0.85)
  })

  it('draws fewer streaks on a lower quality and a phone', () => {
    const look = WEATHER_LOOKS.blizzard
    expect(maxWeatherStreaks(look, 1, false)).toBe(look.streaks)
    expect(maxWeatherStreaks(look, 0.5, false)).toBeLessThan(look.streaks)
    expect(maxWeatherStreaks(look, 1, true)).toBe(look.streaks / 2)
  })
})

describe('level weather', () => {
  const levels = getAllLevels()

  it('is the Desert sandstorm and the Antarctica blizzard, nowhere else', () => {
    const set = levels.filter((l) => l.weather).map((l) => [l.id, l.weather!.kind])
    expect(set).toEqual([['level2', 'sandstorm'], ['level4', 'blizzard']])
  })

  it.each(levels.filter((l) => l.weather).map((l) => [l.id, l] as const))('%s: tied to a real wave, 4-8 s with both ramps, cleared before the run ends', (_, level) => {
    const { wave, seconds } = level.weather!
    expect(level.enemies[wave]).toBeDefined()
    expect(seconds).toBeGreaterThanOrEqual(4)
    expect(seconds).toBeLessThanOrEqual(8)
    expect(seconds).toBeGreaterThan(WEATHER_RAMP.inS + WEATHER_RAMP.outS)
    expect(level.enemies[wave].spawnDelay! + seconds).toBeLessThan(level.boss?.at ?? 60)
  })
})
