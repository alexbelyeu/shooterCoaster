import { describe, expect, it } from 'vitest'
import { ATMOSPHERES } from '@/levels/environments/atmosphere'
import { NIGHT_ATMOSPHERES } from '@/levels/environments/nightPreset'
import { combineFog, createFogModifiers, resetFogModifiers } from './sceneFog'

describe('combineFog', () => {
  const base = ATMOSPHERES.volcanic

  it("is the biome's own fog exactly with no effect", () => {
    expect(combineFog(base, createFogModifiers(), { near: 0, far: 0 })).toEqual({ near: base.fogNear, far: base.fogFar })
  })

  it("multiplies every effect's modifier in, so effects that meet both close the fog", () => {
    const mods = createFogModifiers()
    mods.dark.far = 0.5
    mods.eruption.far = 0.4
    mods.weather.near = 0.3
    mods.weather.far = 0.3
    const out = combineFog(base, mods, { near: 0, far: 0 })
    expect(out.far).toBeCloseTo(base.fogFar * 0.5 * 0.4 * 0.3)
    expect(out.near).toBeLessThanOrEqual(out.far * 0.5)
    resetFogModifiers(mods)
    expect(mods).toEqual(createFogModifiers())
  })

  it('pulls the near in with a far that closes past it', () => {
    const mods = createFogModifiers()
    mods.dark.far = 0.01
    const out = combineFog({ fogNear: 400, fogFar: 5200 }, mods, { near: 0, far: 0 })
    expect(out).toEqual({ near: 26, far: 52 })
  })

  const nights = Object.entries(NIGHT_ATMOSPHERES).map(([biome, a]) => [`${biome} night`, a!] as const)
  it.each([...Object.entries(ATMOSPHERES), ...nights])("keeps %s's own near inside half its far", (_, atmosphere) => {
    expect(atmosphere.fogNear).toBeLessThanOrEqual(atmosphere.fogFar * 0.5)
  })
})
