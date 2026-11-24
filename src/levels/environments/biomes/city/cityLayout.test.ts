import { describe, expect, it } from 'vitest'
import { shippedLevel } from '@/levels/shippedLevels'
import { buildArcTable } from '@/track/arcLength'
import { createTrackCurve } from '@/track/curves/createTrackCurve'
import { trackExtent } from '../../shared/trackScatter'
import { layoutCity, STREET_GRID } from './cityLayout'

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
