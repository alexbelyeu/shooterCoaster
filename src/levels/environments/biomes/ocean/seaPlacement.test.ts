import { describe, expect, it } from 'vitest'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { buildArcTable } from '@/track/arcLength'
import { createTrigCurve } from '@/track/curves/TrigCurve'
import {
  createHeightFunction,
  createTerrainSurface,
  getTerrainMeshSize,
  sampleTrackPath,
} from '@/utils/terrainNoise'
import { buildTrackIndex } from '../../shared/trackClearance'
import { trackExtent } from '../../shared/trackScatter'
import {
  KELP_HEIGHT,
  ROCK_FOOTPRINT,
  ROCK_HEIGHT,
  STACK_FOOTPRINT,
  STACK_HEIGHT,
  STACK_RINGS,
  profileRadiusAt,
} from './seaDimensions'
import { layoutOcean, maxGroundUnder } from './seaPlacement'

const level = getLevelConfig('level3')!
const { varA, varB, varC, scalar } = level.track
const curve = createTrigCurve(varA, varB, varC, scalar)
const table = buildArcTable(curve)
const groundFn = createTerrainSurface(
  createHeightFunction('ocean', sampleTrackPath((t) => curve.getPointAt(t))),
  getTerrainMeshSize('ocean'),
)
const city = { x: 1800, z: -1400, r: 320 }
const layout = layoutOcean(groundFn, table, [city])
const extent = trackExtent(table)
const trackIndex = buildTrackIndex(table)

describe('layoutOcean (level 3)', () => {
  it('is the same every run', () => {
    expect(layoutOcean(groundFn, table, [city])).toEqual(layout)
  })

  it('stands 6–10 sea stacks in open water beyond the track, clear of the city', () => {
    const { stacks } = layout
    expect(stacks.length).toBeGreaterThanOrEqual(6)
    expect(stacks.length).toBeLessThanOrEqual(10)
    for (const s of stacks) {
      expect(Math.hypot(s.x, s.z)).toBeGreaterThan(extent * 1.2)
      expect(maxGroundUnder(groundFn, s.x, s.z, STACK_FOOTPRINT * s.scale)).toBeLessThan(-6)
      expect(s.y + STACK_HEIGHT * s.scale).toBeGreaterThan(150)
      expect(Math.hypot(s.x - city.x, s.z - city.z)).toBeGreaterThan(city.r)
      expect(profileRadiusAt(STACK_RINGS, -s.y / s.scale)).toBeGreaterThan(30)
    }
  })

  it('breaks the surface with rocks near the ride, off the rails', () => {
    expect(layout.rocks.length).toBeGreaterThanOrEqual(10)
    for (const r of layout.rocks) {
      const top = r.y + ROCK_HEIGHT * r.scale
      expect(top).toBeGreaterThanOrEqual(5 - 1e-6)
      expect(top).toBeLessThanOrEqual(22 + 1e-6)
      expect(r.y).toBeLessThanOrEqual(groundFn(r.x, r.z))
      expect(trackIndex.near(r.x, r.z, 90)).toBe(false)
      expect(maxGroundUnder(groundFn, r.x, r.z, ROCK_FOOTPRINT * r.scale)).toBeLessThan(-10)
    }
  })

  it('circles 8–12 gulls above the stack tops', () => {
    expect(layout.gulls.length).toBeGreaterThanOrEqual(8)
    expect(layout.gulls.length).toBeLessThanOrEqual(12)
    const tallest = Math.max(...layout.stacks.map((s) => s.y + STACK_HEIGHT * s.scale))
    for (const g of layout.gulls) {
      expect(g.y).toBeGreaterThan(150)
      expect(g.y).toBeLessThan(tallest + 120)
      expect(g.speed).not.toBe(0)
    }
  })

  it('keeps coral and kelp under the water', () => {
    expect(layout.coral.length).toBeGreaterThan(60)
    expect(layout.kelp.length).toBeGreaterThan(40)
    for (const c of layout.coral) expect(c.y).toBeLessThan(-15)
    for (const k of layout.kelp) expect(k.y + KELP_HEIGHT * k.scale).toBeLessThanOrEqual(-6 + 1e-6)
  })
})

describe('profileRadiusAt', () => {
  it('interpolates between rings and clamps at the ends', () => {
    const rings = [
      { y: 0, r: 10 },
      { y: 10, r: 6 },
      { y: 10, r: 4 },
      { y: 20, r: 2 },
    ]
    expect(profileRadiusAt(rings, -5)).toBe(10)
    expect(profileRadiusAt(rings, 5)).toBeCloseTo(8)
    expect(profileRadiusAt(rings, 15)).toBeCloseTo(3)
    expect(profileRadiusAt(rings, 30)).toBe(2)
  })
})
