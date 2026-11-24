import { describe, expect, it } from 'vitest'
import { shippedLevel } from '@/levels/shippedLevels'
import { buildArcTable } from '@/track/arcLength'
import { createTrackCurve } from '@/track/curves/createTrackCurve'
import { trackExtent } from '../../shared/trackScatter'
import { buildTrackIndex } from '../../shared/trackClearance'
import { createRng } from '@/utils/rng'
import { cityTowers, clearOfTowers, footprintDistance, KERB_OFFSET, layoutCity, onPavement, streetAxis, TRACK_CLEARANCE, type Tower } from './cityLayout'
import { HERO_SHOT, STREET_GRID } from './config'
import { orbitPose } from '@/track/introCamera.hot'
import { PASS_OUT } from '@/track/introTour'

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
    // Off the rails by the clearance, the ride's streets lined with them (#871)
    const clearance = (t: Tower) => Math.min(...Array.from({ length: table.count }, (_, i) => footprintDistance(t, table.x[i], table.z[i])))
    expect(layout.towers.filter((t) => clearance(t) < TRACK_CLEARANCE)).toEqual([])
    expect(layout.towers.filter((t) => clearance(t) < 2 * TRACK_CLEARANCE).length).toBeGreaterThan(40)
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

describe('clearOfTowers', () => {
  // One block's tower round the spot: the streets either side of it along x are the nearest clear spots
  const tower: Tower = { x: 0, z: 0, w: 176, d: 176, h: 300 }
  const p = { x: 0, y: 50, z: 0 }
  const c = { x: 60, y: 24, z: 32 }

  it('without eyes, the nearest clear street', () => {
    expect(Math.abs(clearOfTowers([tower], p, 0, c).z)).toBe(STREET_GRID.pitch / 2)
  })

  it('the street an eye sees past the tower over a nearer one it hides (#871)', () => {
    for (const side of [-1, 1]) {
      const eye = { x: 0, y: 50, z: side * 1000 }
      expect(clearOfTowers([tower], p, 0, c, () => [eye])).toEqual({ x: 0, y: 50, z: (side * STREET_GRID.pitch) / 2 })
    }
  })
})

describe('onPavement', () => {
  const towers = cityTowers(table, extent)
  const index = buildTrackIndex(table)

  it('moves a ground spot onto a pavement kerb, off the rails (all but where the rails take every kerb) and out of every tower', () => {
    const rng = createRng(963)
    const { pitch } = STREET_GRID
    const misplaced: string[] = []
    const underCar: string[] = []
    let onRails = 0
    for (let k = 0; k < 400; k++) {
      const p = { x: rng.range(-extent, extent), y: 0, z: rng.range(-extent, extent) }
      const q = onPavement(towers, index, p)
      // On a kerb along one street or the other (where streets cross, `streetAxis` reads the one along x)
      const kerbOff = (c: number) => Math.abs(Math.abs(c - (Math.round(c / pitch - 0.5) + 0.5) * pitch) - KERB_OFFSET)
      const onKerb = streetAxis(q.x, q.z) !== null && Math.min(kerbOff(q.x), kerbOff(q.z)) < 1e-6
      const inTower = towers.some((t) => Math.abs(q.x - t.x) < t.w / 2 && Math.abs(q.z - t.z) < t.d / 2)
      if (!onKerb || inTower || Math.hypot(q.x - p.x, q.z - p.z) > pitch * 2.5) misplaced.push(`${p.x.toFixed(0)},${p.z.toFixed(0)}`)
      if (trackDistance(q.x, q.z) < 40) onRails++
      // Never under the car: even where the rails take every kerb, a moved spot keeps the smaller rail clearance
      if (q !== p && trackDistance(q.x, q.z) < 30) underCar.push(`${q.x.toFixed(0)},${q.z.toFixed(0)}`)
    }
    expect(misplaced).toEqual([])
    expect(underCar).toEqual([])
    // The helix round the hero tower rings its kerbs (#871)
    expect(onRails).toBeLessThan(10)
  })

  it('picks the kerb spot the approach sees past the towers over a nearer hidden one', () => {
    // One block's tower; the rider looks at it from the south, so the kerb north of it is hidden
    const block = [{ x: 0, z: 0, w: 176, d: 176, h: 200 }]
    const offRails = { near: () => false } as unknown as Parameters<typeof onPavement>[1]
    const p = { x: 0, y: 0, z: 130 }
    expect(onPavement(block, offRails, p)).toEqual({ x: 0, y: 0, z: STREET_GRID.pitch / 2 + KERB_OFFSET })
    expect(onPavement(block, offRails, p, () => [{ x: 0, y: 30, z: -400 }])).toEqual({ x: 0, y: 0, z: -STREET_GRID.pitch / 2 - KERB_OFFSET })
  })

  it('reads the street a spot is on, null inside a block', () => {
    const { pitch } = STREET_GRID
    expect(streetAxis(10, pitch / 2 + KERB_OFFSET)).toBe('x')
    expect(streetAxis(-pitch / 2 - KERB_OFFSET, 10)).toBe('z')
    expect(streetAxis(0, 0)).toBeNull()
  })
})

describe('the hero shot', () => {
  const towers = cityTowers(table, extent)
  /** Margin round a footprint and over a roof the camera keeps. */
  const MARGIN = 30
  const insideTowers = (x: number, y: number, z: number) =>
    towers.filter((t) => y < t.h + MARGIN && Math.abs(x - t.x) < t.w / 2 + MARGIN && Math.abs(z - t.z) < t.d / 2 + MARGIN)

  it('flies the results orbit over every tower it crosses (#966)', () => {
    const pos = { x: 0, y: 0, z: 0 }
    const target = { x: 0, y: 0, z: 0 }
    const hit: Tower[] = []
    for (let s = 0; s < 60; s += 0.1) {
      orbitPose(HERO_SHOT, 0, s, 0, () => 0, undefined, pos, target)
      hit.push(...insideTowers(pos.x, pos.y, pos.z))
    }
    expect(hit).toEqual([])
  })

  it("flies the intro's landmark pass over every tower round it", () => {
    const r = HERO_SHOT.orbitRadius * PASS_OUT
    const hit: Tower[] = []
    for (let i = 0; i < 720; i++) {
      const a = (i / 720) * 2 * Math.PI
      hit.push(...insideTowers(HERO_SHOT.x + Math.cos(a) * r, HERO_SHOT.orbitHeight, HERO_SHOT.z + Math.sin(a) * r))
    }
    expect(hit).toEqual([])
  })
})
