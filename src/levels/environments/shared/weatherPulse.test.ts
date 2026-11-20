import { describe, expect, it } from 'vitest'
import { getAllLevels } from '@/levels/LevelRegistry'
import { ATMOSPHERES } from '@/levels/environments/atmosphere'
import { boostStrength } from './particlePresets'
import { combineFog, createFogModifiers } from './sceneFog'
import { levelWeather, maxWeatherStreaks, WEATHER_LOOKS, weatherFog, weatherSeconds } from './weatherPulse'

describe('weatherFog', () => {
  const look = WEATHER_LOOKS.sandstorm

  it('lets the fog go exactly once the pulse has cleared', () => {
    const out = { near: 0, far: 0 }
    const seconds = weatherSeconds('sandstorm')
    for (const elapsed of [0.5, 2, seconds - 0.5]) weatherFog(look, boostStrength(look.pulse, elapsed), out)
    weatherFog(look, boostStrength(look.pulse, seconds + 0.1), out)
    expect(out).toEqual({ near: 1, far: 1 })
  })

  it("closes the biome's fog in at the hold, never past the near plane", () => {
    const base = ATMOSPHERES.desert
    const mods = createFogModifiers()
    weatherFog(look, 1, mods.weather)
    const out = combineFog(base, mods, { near: 0, far: 0 })
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
  const withWeather = levels.filter((l) => levelWeather(l.enemies)).map((l) => [l.id, l] as const)

  it('is the Desert sandstorm and the Antarctica blizzard, nowhere else', () => {
    expect(withWeather.map(([id, l]) => [id, levelWeather(l.enemies)!.kind])).toEqual([['level2', 'sandstorm'], ['level4', 'blizzard']])
  })

  it.each(withWeather)('%s: one kind, 4-8 s, cleared before the boss', (_, level) => {
    const { kind, wave } = levelWeather(level.enemies)!
    expect(new Set(level.enemies.flatMap((w) => (w.weather ? [w.weather] : []))).size).toBe(1)
    const seconds = weatherSeconds(kind)
    expect(seconds).toBeGreaterThanOrEqual(4)
    expect(seconds).toBeLessThanOrEqual(8)
    expect(wave.spawnDelay! + seconds).toBeLessThan(level.boss?.at ?? 60)
  })
})
