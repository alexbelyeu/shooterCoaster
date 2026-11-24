import { describe, expect, it } from 'vitest'
import { shippedLevel } from '@/levels/shippedLevels'
import { buildArcTable } from '@/track/arcLength'
import { createTrackCurve } from '@/track/curves/createTrackCurve'
import { createHeightFunction, onTerraces, sampleTrackPath, type Terrace } from '@/utils/terrainNoise'
import { FALLS, TEMPLE } from './config'
import { mistBanks } from './jungleLayout'

const curve = createTrackCurve(shippedLevel('level8').track)
const table = buildArcTable(curve)
const groundFn = createHeightFunction('jungle', sampleTrackPath((t) => curve.getPointAt(t)))

describe('onTerraces', () => {
  const terrace: Terrace = { x: 100, z: -50, y: 40, radius: 200, falloff: 100 }

  it('is flat at the terrace height inside its radius', () => {
    for (const [dx, dz] of [[0, 0], [150, 0], [0, -199], [-120, 120]]) {
      expect(onTerraces([terrace], terrace.x + dx, terrace.z + dz, 300)).toBe(40)
    }
  })

  it('leaves the ground alone past radius + falloff', () => {
    expect(onTerraces([terrace], terrace.x + 301, terrace.z, 300)).toBe(300)
  })

  it('eases continuously across the falloff, between the terrace and the noise', () => {
    let prev = onTerraces([terrace], terrace.x + terrace.radius, terrace.z, 300)
    let maxStep = 0
    for (let d = terrace.radius + 1; d <= terrace.radius + terrace.falloff; d++) {
      const h = onTerraces([terrace], terrace.x + d, terrace.z, 300)
      maxStep = Math.max(maxStep, Math.abs(h - prev))
      if (h < 40 || h > 300) maxStep = Infinity
      prev = h
    }
    // smoothstep's steepest slope is 1.5 per falloff: 260 m of rise over 100 m, at most ~4 m a metre
    expect(maxStep).toBeLessThan(4)
  })
})

describe('mistBanks', () => {
  const banks = mistBanks(table, groundFn)

  it('is seeded: the same mist every visit', () => {
    expect(mistBanks(table, groundFn)).toEqual(banks)
  })

  it('keeps every valley bank off the rails, so it never veils a target', () => {
    // The last eight are the temple's and the waterfall's banks, placed by hand
    const valley = banks.slice(0, -8)
    expect(valley.length).toBeGreaterThan(20)
    let closest = Infinity
    for (const b of valley) {
      for (let i = 0; i < table.count; i++) closest = Math.min(closest, Math.hypot(table.x[i] - b.x, table.z[i] - b.z))
    }
    expect(closest).toBeGreaterThan(130)
  })
})

// The ride is still the legacy curve1 (#870's first cut): until its storyboard lands, keep the temple and the
// waterfall in front of the drop, the shot the level is built round.
describe('the drop frames the temple', () => {
  function bearing(u: number, x: number, z: number): number {
    const i = Math.round(u * (table.count - 1))
    const j = Math.min(table.count - 1, i + 3)
    const fx = table.x[j] - table.x[i]
    const fz = table.z[j] - table.z[i]
    const dx = x - table.x[i]
    const dz = z - table.z[i]
    return (Math.acos((fx * dx + fz * dz) / Math.hypot(fx, fz) / Math.hypot(dx, dz)) * 180) / Math.PI
  }

  it('has the temple dead ahead and the waterfall in view from the crest to the valley floor', () => {
    let temple = 0
    let falls = 0
    for (let u = 0.122; u <= 0.16; u += 0.002) {
      temple = Math.max(temple, bearing(u, TEMPLE.x, TEMPLE.z))
      falls = Math.max(falls, bearing(u, FALLS.x, FALLS.z))
    }
    expect(temple).toBeLessThan(20)
    expect(falls).toBeLessThan(35)
  })
})
