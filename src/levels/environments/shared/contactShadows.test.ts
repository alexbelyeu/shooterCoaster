import { describe, expect, it } from 'vitest'
import { buildContactShadowGeometry, roundCaster, SHADOW_LIFT, type ShadowCaster } from './contactShadows'
import { createRng } from '@/utils/rng'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { buildArcTable } from '@/track/arcLength'
import { createTrigCurve2 } from '@/track/curves/TrigCurve2'
import { getTrackDimensions } from '@/track/trackDimensions'
import { planTowers, towerShadowCasters } from '@/track/supportTowers'
import { createHeightFunction, createTerrainSurface, getTerrainMeshSize, sampleTrackPath } from '@/utils/terrainNoise'

// Arctic: the most ridged terrain, where the drawn mesh strays furthest from heightFn.
const level = getLevelConfig('level4')!
const curve = createTrigCurve2(level.track.varA, level.track.varB, level.track.varC, level.track.scalar)
const table = buildArcTable(curve)
const heightFn = createHeightFunction('arctic', sampleTrackPath((t) => curve.getPointAt(t)))
const groundFn = createTerrainSurface(heightFn, getTerrainMeshSize('arctic'))

function scatterCasters(n: number): ShadowCaster[] {
  const rng = createRng(7)
  return Array.from({ length: n }, () => ({
    x: rng.range(-3000, 3000),
    z: rng.range(-3000, 3000),
    halfX: rng.range(2, 120),
    halfZ: rng.range(2, 120),
    yaw: rng.range(0, Math.PI * 2),
    radius: rng.range(0, 10),
    spread: rng.range(2, 40),
    strength: 0.5,
  }))
}

describe('buildContactShadowGeometry', () => {
  it('stays within a polygon-offset hair of the drawn terrain, rarely floating', () => {
    const geo = buildContactShadowGeometry(scatterCasters(60), groundFn)
    const pos = geo.getAttribute('position')
    const index = geo.getIndex()!
    const rng = createRng(3)
    let worstBelow = 0
    let floats = 0
    let samples = 0
    for (let t = 0; t < index.count; t += 3) {
      const [a, b, c] = [index.getX(t), index.getX(t + 1), index.getX(t + 2)]
      for (let s = 0; s < 4; s++) {
        let u = rng()
        let v = rng()
        if (u + v > 1) [u, v] = [1 - u, 1 - v]
        const w = 1 - u - v
        const x = pos.getX(a) * w + pos.getX(b) * u + pos.getX(c) * v
        const y = pos.getY(a) * w + pos.getY(b) * u + pos.getY(c) * v
        const z = pos.getZ(a) * w + pos.getZ(b) * u + pos.getZ(c) * v
        const gap = y - groundFn(x, z)
        worstBelow = Math.min(worstBelow, gap)
        if (gap > 6) floats++
        samples++
      }
    }
    expect(worstBelow).toBeGreaterThan(-0.5)
    expect(floats / samples).toBeLessThan(0.1)
  })

  it('is front-facing up, SHADOW_LIFT above flat ground, and carries the caster box', () => {
    const geo = buildContactShadowGeometry([roundCaster(10, -20, 8, 0.7)], () => 5)
    const pos = geo.getAttribute('position')
    for (let i = 0; i < pos.count; i++) expect(pos.getY(i)).toBeCloseTo(5 + SHADOW_LIFT)
    const box = geo.getAttribute('aBox')
    expect([box.getX(0), box.getY(0), box.getZ(0), box.getW(0)]).toEqual([8, 8, 8, expect.closeTo(4.8)])
    expect(geo.getAttribute('aStrength').getX(0)).toBeCloseTo(0.7)
    const idx = geo.getIndex()!
    const [a, b, c] = [idx.getX(0), idx.getX(1), idx.getX(2)]
    const abx = pos.getX(b) - pos.getX(a)
    const abz = pos.getZ(b) - pos.getZ(a)
    const acx = pos.getX(c) - pos.getX(a)
    const acz = pos.getZ(c) - pos.getZ(a)
    expect(abz * acx - abx * acz).toBeGreaterThan(0)
  })

  it('switches to 32-bit indices past 65535 vertices', () => {
    const many = Array.from({ length: 300 }, (_, i) => roundCaster(i * 300, 0, 150, 0.5))
    const geo = buildContactShadowGeometry(many, () => 0)
    expect(geo.getAttribute('position').count).toBeGreaterThan(65535)
    expect(geo.getIndex()!.array).toBeInstanceOf(Uint32Array)
  })
})

describe('towerShadowCasters', () => {
  it('gives every tower a pool per footing and one footprint square', () => {
    const plan = planTowers(curve, table, getTrackDimensions(level.track), heightFn, groundFn)
    const casters = towerShadowCasters(plan)
    expect(plan.towers.length).toBeGreaterThan(0)
    expect(casters).toHaveLength(plan.towers.length * 5)
    const footprint = casters[4]
    const pad = casters[0]
    expect(footprint.halfX).toBeGreaterThan(pad.halfX * 2)
    expect(footprint.strength).toBeLessThan(pad.strength)
  })
})
