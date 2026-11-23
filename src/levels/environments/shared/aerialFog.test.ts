import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { ATMOSPHERES } from '../atmosphere'
import { NIGHT_ATMOSPHERES } from '../nightPreset'
import { AERIAL_PARS_FRAGMENT, AERIAL_PARS_VERTEX, AERIAL_UNIFORMS, installAerialFog, resolveAerialFog, setAerialFog } from './aerialFog'
import { aerialDamp, createFogModifiers } from './sceneFog'

const finite = (v: readonly number[]) => v.every(Number.isFinite)
const xyz = (v: { x: number; y: number; z: number }) => [v.x, v.y, v.z]

describe('resolveAerialFog', () => {
  it('gives every biome finite values in range, a unit sun heading, and a sunlit haze where the sky has a sun glow or opts in', () => {
    for (const [biome, atmosphere] of Object.entries(ATMOSPHERES)) {
      const v = resolveAerialFog(atmosphere)
      expect(finite([...xyz(v.sunDir), ...xyz(v.sunTint), ...xyz(v.away), v.strength]), biome).toBe(true)
      expect(Math.hypot(...xyz(v.sunDir)), biome).toBeCloseTo(1, 6)
      expect(v.sunDir.y, biome).toBe(0)
      expect(v.strength, biome).toBeGreaterThanOrEqual(0)
      expect(v.strength, biome).toBeLessThanOrEqual(1)
      expect([...xyz(v.sunTint), ...xyz(v.away)].every((c) => c >= 0 && c <= 2), biome).toBe(true)
      expect(v.strength > 0, biome).toBe(atmosphere.sky.sunGlow > 0 || (atmosphere.aerialFog?.strength ?? 0) > 0)
    }
  })

  it('leaves the gym and every Night Ride flat', () => {
    expect(resolveAerialFog(ATMOSPHERES.gym).strength).toBe(0)
    for (const night of Object.values(NIGHT_ATMOSPHERES)) expect(resolveAerialFog(night).strength).toBe(0)
  })

  it('warms towards the sun: the sun tint is brighter than the horizon fog', () => {
    const v = resolveAerialFog(ATMOSPHERES.themePark)
    const fog = new THREE.Color(ATMOSPHERES.themePark.sky.horizon)
    expect(v.sunTint.x).toBeGreaterThan(fog.r)
  })

  it('turns itself off for a sun straight overhead rather than dividing by zero', () => {
    expect(resolveAerialFog({ ...ATMOSPHERES.themePark, sunDirection: [0, 0, 0] }).strength).toBe(0)
    expect(resolveAerialFog({ ...ATMOSPHERES.themePark, sunDirection: [0, 1, 0] }).strength).toBe(0)
  })
})

describe('aerialDamp', () => {
  it('is 1 with no effect and 0 once an effect has closed the fog to half its far', () => {
    const mods = createFogModifiers()
    expect(aerialDamp(mods)).toBe(1)
    mods.weather.far = 0.3
    expect(aerialDamp(mods)).toBe(0)
    mods.weather.far = 0.75
    expect(aerialDamp(mods)).toBeCloseTo(0.5, 6)
  })
})

describe('installAerialFog', () => {
  it('declares the uniforms it reads and shares one value object with every material', () => {
    expect(AERIAL_PARS_VERTEX).toContain('uniform vec4 uAerialSun;')
    for (const name of ['uAerialSunTint', 'uAerialAway']) expect(AERIAL_PARS_FRAGMENT).toContain(`uniform vec3 ${name};`)
    expect(Object.keys(AERIAL_UNIFORMS).sort()).toEqual(['uAerialAway', 'uAerialSun', 'uAerialSunTint'])
    installAerialFog()
    expect(THREE.ShaderChunk.fog_fragment).toContain('aerialFogColor')
    const standard = THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms)
    const merged = THREE.UniformsUtils.merge([THREE.UniformsLib.fog])
    expect(standard.uAerialSun.value).toBe(AERIAL_UNIFORMS.uAerialSun.value)
    expect(merged.uAerialAway.value).toBe(AERIAL_UNIFORMS.uAerialAway.value)
    setAerialFog(resolveAerialFog(ATMOSPHERES.desert), 0.5)
    expect(standard.uAerialSun.value.w).toBeCloseTo(resolveAerialFog(ATMOSPHERES.desert).strength * 0.5, 6)
  })
})
