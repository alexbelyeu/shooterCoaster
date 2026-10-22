import { describe, expect, it } from 'vitest'
import {
  createRng,
  groundedBaseY,
  scatterNearTrack,
  settleOnGround,
  trackExtent,
} from './trackScatter'
import { buildTrackIndex } from './trackClearance'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { buildArcTable } from '@/track/arcLength'
import { createTrigCurve2 } from '@/track/curves/TrigCurve2'
import {
  createHeightFunction,
  createTerrainSurface,
  getTerrainMeshSize,
  getTerrainSlope,
  sampleTrackPath,
} from '@/utils/terrainNoise'

const level = getLevelConfig('level4')!
const { varA, varB, varC, scalar } = level.track
const curve = createTrigCurve2(varA, varB, varC, scalar)
const table = buildArcTable(curve)
const index = buildTrackIndex(table)
const heightFn = createHeightFunction('arctic', sampleTrackPath((t) => curve.getPointAt(t)))
const groundFn = createTerrainSurface(heightFn, getTerrainMeshSize('arctic'))

describe('createRng', () => {
  it('is deterministic per seed and stays in [0, 1)', () => {
    const a = createRng(7)
    const b = createRng(7)
    for (let i = 0; i < 1000; i++) {
      const v = a()
      expect(v).toBe(b())
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('trackExtent', () => {
  it('matches the varC * 13 * scalar rule for level4', () => {
    const extent = trackExtent(table)
    expect(extent).toBeLessThanOrEqual(varC * 13 * scalar * 1.01)
    expect(extent).toBeGreaterThan(varC * 13 * scalar * 0.5)
  })
})

describe('scatterNearTrack (level4)', () => {
  const opts = {
    count: 150,
    track: table,
    heightFn,
    minDist: 70,
    maxDist: 900,
    maxRadius: trackExtent(table) * 1.5,
    maxSlope: Math.PI / 6,
    bias: 1.8,
  }
  const points = scatterNearTrack({ ...opts, rng: createRng(19) })

  it('fills the requested count', () => {
    expect(points.length).toBe(opts.count)
  })

  it('keeps clear of the track, inside maxRadius, on gentle slopes', () => {
    for (const p of points) {
      expect(index.near(p.x, p.z, opts.minDist)).toBe(false)
      expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(opts.maxRadius)
      expect(getTerrainSlope(heightFn, p.x, p.z)).toBeLessThanOrEqual(opts.maxSlope + 1e-9)
      expect(p.y).toBe(heightFn(p.x, p.z))
    }
  })

  it('is biased towards the track', () => {
    const near = points.filter((p) => index.near(p.x, p.z, 400)).length
    expect(near / points.length).toBeGreaterThan(0.5)
  })

  it('is deterministic for a seed', () => {
    expect(scatterNearTrack({ ...opts, rng: createRng(19) })).toEqual(points)
  })
})

describe('settleOnGround (level4 crystal settings)', () => {
  const count = 70
  const footprint = 10
  const height = 60
  const maxBury = 0.2
  const rng = createRng(19)
  const candidates = scatterNearTrack({
    count: count * 3,
    track: table,
    heightFn: groundFn,
    minDist: 70,
    maxDist: 900,
    maxRadius: trackExtent(table) * 1.5,
    maxSlope: Math.PI / 6,
    bias: 1.8,
    rng,
  })
  const props = settleOnGround(candidates, groundFn, {
    count,
    scaleRange: [1.2, 2.6],
    footprint,
    height,
    sink: 1,
    maxBury,
    rng,
  })

  it('finds enough flat-enough spots', () => {
    expect(props.length).toBe(count)
  })

  it('never floats: the drawn ground under the footprint is never below the base', () => {
    for (const p of props) {
      expect(p.y).toBe(groundedBaseY(groundFn, p.x, p.z, footprint * p.scale, 1))
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        for (const r of [0, 0.5, 1]) {
          const R = footprint * p.scale * r
          expect(groundFn(p.x + Math.cos(a) * R, p.z + Math.sin(a) * R)).toBeGreaterThanOrEqual(p.y)
        }
      }
    }
  })

  it('never buries more than maxBury of the prop at its centre', () => {
    for (const p of props) {
      expect(groundFn(p.x, p.z) - p.y).toBeLessThanOrEqual(height * p.scale * maxBury)
    }
  })
})
