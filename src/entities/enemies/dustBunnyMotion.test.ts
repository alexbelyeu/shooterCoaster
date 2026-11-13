import { describe, expect, it } from 'vitest'
import { DUST_BUNNY, DUST_BUNNY_BOUNCE, dustBunnyPose, newDustBunnyPose } from './dustBunnyMotion'

const R = 19
const at = (base: number, t: number) => dustBunnyPose(base, R, t, newDustBunnyPose())

describe('dustBunnyPose', () => {
  it('drifts slowly along its heading, weaving a little', () => {
    const base = 1.2
    const p = at(base, 10)
    const along = p.x * Math.sin(base) + p.z * Math.cos(base)
    const across = p.x * Math.cos(base) - p.z * Math.sin(base)
    expect(along).toBeCloseTo(DUST_BUNNY.speed * 10)
    expect(Math.abs(across)).toBeLessThanOrEqual(DUST_BUNNY.weave + 1e-9)
  })

  it('faces the way it is going', () => {
    const base = -0.4
    for (const t of [0, 1.3, 4.1, 7.7]) {
      const a = at(base, t)
      const b = at(base, t + 0.001)
      expect(a.heading).toBeCloseTo(Math.atan2(b.x - a.x, b.z - a.z), 3)
    }
  })

  it('rolls by the distance it covers over its radius', () => {
    expect(at(0, 3).roll).toBeCloseTo((DUST_BUNNY.speed * 3) / R)
  })

  it('bounces once a bounce, squashing only near the floor', () => {
    const touch = at(0, DUST_BUNNY_BOUNCE)
    expect(touch.lift).toBeCloseTo(0)
    expect(touch.squash).toBeCloseTo(DUST_BUNNY.squash)
    const top = at(0, DUST_BUNNY_BOUNCE / 2)
    expect(top.lift).toBeCloseTo(DUST_BUNNY.bob)
    expect(top.squash).toBe(0)
  })
})
