import { describe, expect, it } from 'vitest'
import { groundedBaseY, scatterNearTrack, settleOnGround, trackExtent } from './trackScatter'
import { createRng } from '@/utils/rng'
import { buildTrackIndex } from './trackClearance'
import type { TrigTrackParams } from '@/types/level'
import { buildArcTable } from '@/track/arcLength'
import { createTrackCurve } from '@/track/curves/createTrackCurve'
import {
  createHeightFunction,
  createTerrainSurface,
  getTerrainMeshSize,
  getTerrainSlope,
  sampleTrackPath,
} from '@/utils/terrainNoise'

// Level 2's trig loop before its ride-kit ride (#864): the desert terrain the scatter settings were tuned on.
const track: TrigTrackParams = {
  varA: 5, varB: 27, varC: 2, scalar: 60, rollerSpeed: 0.000004, minRollerSpeed: 0.00006, curve: 'curve1', color1: 0x51411a, color2: 0x812a2a,
}
const curve = createTrackCurve(track)
const table = buildArcTable(curve)
const index = buildTrackIndex(table)
const heightFn = createHeightFunction('desert', sampleTrackPath((t) => curve.getPointAt(t)))
const groundFn = createTerrainSurface(heightFn, getTerrainMeshSize('desert'))

describe('trackExtent', () => {
  it('matches the varC * 13 * scalar rule', () => {
    const extent = trackExtent(table)
    expect(extent).toBeLessThanOrEqual(track.varC * 13 * track.scalar * 1.01)
    expect(extent).toBeGreaterThan(track.varC * 13 * track.scalar * 0.5)
  })
})

describe('scatterNearTrack (desert trig loop)', () => {
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

describe('settleOnGround (desert trig loop, ice crystal settings)', () => {
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
