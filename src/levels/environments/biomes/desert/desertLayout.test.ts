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
import { trackExtent } from '../../shared/trackScatter'
import { dustDevilCenter, layoutDesert, MESA_FOOTPRINT, MESA_HEIGHT } from './desertLayout'
import { LANDMARK_FOOTPRINTS } from './landmarks'

const level = getLevelConfig('level2')!
const { varA, varB, varC, scalar } = level.track
const curve = createTrigCurve(varA, varB, varC, scalar)
const table = buildArcTable(curve)
const groundFn = createTerrainSurface(
  createHeightFunction('desert', sampleTrackPath((t) => curve.getPointAt(t))),
  getTerrainMeshSize('desert'),
)
const layout = layoutDesert(groundFn, table)
const extent = trackExtent(table)

/** Brute force over every arc-table sample (the layout uses the strided grid index). */
function trackDistance(x: number, z: number): number {
  let min = Infinity
  for (let i = 0; i < table.count; i++) min = Math.min(min, Math.hypot(table.x[i] - x, table.z[i] - z))
  return min
}

describe('layoutDesert (level 2)', () => {
  it('is the same every run', () => {
    expect(layoutDesert(groundFn, table)).toEqual(layout)
  })

  it('stands 4–6 grounded mesas 0.6–1.3× the track extent out, 60–400 units off the track', () => {
    const { mesas } = layout
    expect(mesas.length).toBeGreaterThanOrEqual(4)
    expect(mesas.length).toBeLessThanOrEqual(6)
    for (const m of mesas) {
      const r = Math.hypot(m.x, m.z)
      expect(r).toBeGreaterThanOrEqual(extent * 0.6)
      expect(r).toBeLessThanOrEqual(extent * 1.3)
      const reach = MESA_FOOTPRINT * m.scale
      expect(trackDistance(m.x, m.z) - reach).toBeGreaterThanOrEqual(60)
      expect(trackDistance(m.x, m.z) - reach).toBeLessThan(400)
      for (const c of LANDMARK_FOOTPRINTS) expect(Math.hypot(c.x - m.x, c.z - m.z)).toBeGreaterThan(c.r + reach)
      expect(m.y).toBeLessThanOrEqual(groundFn(m.x, m.z))
      expect(groundFn(m.x, m.z) - m.y).toBeLessThan(MESA_HEIGHT * m.scale * 0.34)
    }
  })

  it('spreads 3–5 dust devils along the ride whose whole wander stays off the track and mesas', () => {
    const { devils, mesas } = layout
    expect(devils.length).toBeGreaterThanOrEqual(3)
    expect(devils.length).toBeLessThanOrEqual(5)
    const p = { x: 0, z: 0 }
    for (const d of devils) {
      const drift = Math.hypot(d.driftX, d.driftZ)
      expect(trackDistance(d.cx, d.cz) - drift).toBeGreaterThanOrEqual(120)
      for (const m of mesas) {
        expect(Math.hypot(m.x - d.cx, m.z - d.cz)).toBeGreaterThan(MESA_FOOTPRINT * m.scale + drift)
      }
      for (let t = 0; t < 120; t += 0.7) {
        dustDevilCenter(d, t, p)
        expect(Math.hypot(p.x - d.cx, p.z - d.cz)).toBeLessThanOrEqual(drift + 1e-9)
      }
      expect(d.spin).not.toBe(0)
    }
  })
})
