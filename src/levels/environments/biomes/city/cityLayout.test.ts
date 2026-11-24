import { describe, expect, it } from 'vitest'
import { shippedLevel } from '@/levels/shippedLevels'
import { buildArcTable } from '@/track/arcLength'
import { createTrackCurve } from '@/track/curves/createTrackCurve'
import { trackExtent } from '../../shared/trackScatter'
import { buildTrackIndex } from '../../shared/trackClearance'
import { createRng } from '@/utils/rng'
import { cityTowers, KERB_OFFSET, layoutCity, onPavement, STREET_GRID, streetAxis } from './cityLayout'

const table = buildArcTable(createTrackCurve(shippedLevel('level7').track))
const extent = trackExtent(table)
const layout = layoutCity(table, extent)

function trackDistance(x: number, z: number): number {
  let min = Infinity
  for (let i = 0; i < table.count; i++) min = Math.min(min, Math.hypot(table.x[i] - x, table.z[i] - z))
  return min
}

describe('layoutCity', () => {
  it('is seeded: the same city every visit', () => {
    expect(layoutCity(table, extent)).toEqual(layout)
  })

  it('fills the city with towers of every height class, none on the track', () => {
    expect(layout.towers.length).toBeGreaterThan(150)
    const heights = layout.towers.map((t) => t.h)
    expect(Math.min(...heights)).toBeLessThan(120)
    expect(Math.max(...heights)).toBeGreaterThan(340)
    const clashes = layout.towers.filter((t) => trackDistance(t.x, t.z) < Math.hypot(t.w, t.d) / 2 + 20)
    expect(clashes).toEqual([])
  })

  it('keeps every tower inside its block, off the streets', () => {
    const { pitch, street } = STREET_GRID
    const inStreet = layout.towers.filter((t) => {
      for (const [c, half] of [[t.x, t.w / 2], [t.z, t.d / 2]]) {
        const local = ((c % pitch) + pitch * 1.5) % pitch - pitch / 2 // centre of the block at 0
        if (Math.abs(local) + half > (pitch - street) / 2 + 0.01) return true
      }
      return false
    })
    expect(inStreet).toEqual([])
  })

  it('rings the city with a taller skyline beyond the towers', () => {
    const farthest = Math.max(...layout.towers.map((t) => Math.hypot(t.x, t.z)))
    for (const s of layout.skyline) expect(Math.hypot(s.x, s.z)).toBeGreaterThan(farthest)
  })

  it('hangs neon signs in every colour on towers near the ride', () => {
    expect(layout.signs.length).toBeGreaterThan(30)
    expect(new Set(layout.signs.map((s) => s.color))).toEqual(new Set(['magenta', 'cyan', 'amber']))
    for (const s of layout.signs) expect(trackDistance(s.x, s.z)).toBeGreaterThan(8)
  })
})

describe('onPavement', () => {
  const towers = cityTowers(table, extent)
  const index = buildTrackIndex(table)

  it('moves a ground spot onto a pavement kerb, off the rails and out of every tower', () => {
    const rng = createRng(963)
    const { pitch } = STREET_GRID
    const misplaced: string[] = []
    for (let k = 0; k < 400; k++) {
      const p = { x: rng.range(-extent, extent), y: 0, z: rng.range(-extent, extent) }
      const q = onPavement(towers, index, p)
      // On a kerb along one street or the other (where streets cross, `streetAxis` reads the one along x)
      const kerbOff = (c: number) => Math.abs(Math.abs(c - (Math.round(c / pitch - 0.5) + 0.5) * pitch) - KERB_OFFSET)
      const onKerb = streetAxis(q.x, q.z) !== null && Math.min(kerbOff(q.x), kerbOff(q.z)) < 1e-6
      const inTower = towers.some((t) => Math.abs(q.x - t.x) < t.w / 2 && Math.abs(q.z - t.z) < t.d / 2)
      if (!onKerb || inTower || trackDistance(q.x, q.z) < 40 || Math.hypot(q.x - p.x, q.z - p.z) > pitch * 1.5) {
        misplaced.push(`${p.x.toFixed(0)},${p.z.toFixed(0)}`)
      }
    }
    expect(misplaced).toEqual([])
  })

  it('reads the street a spot is on, null inside a block', () => {
    const { pitch } = STREET_GRID
    expect(streetAxis(10, pitch / 2 + KERB_OFFSET)).toBe('x')
    expect(streetAxis(-pitch / 2 - KERB_OFFSET, 10)).toBe('z')
    expect(streetAxis(0, 0)).toBeNull()
  })
})
