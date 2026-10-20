import { describe, expect, it } from 'vitest'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { createTrigCurve } from '@/track/curves/TrigCurve'
import { buildArcTable } from '@/track/arcLength'
import { getTrackDimensions } from '@/track/trackDimensions'
import {
  createHeightFunction,
  createTerrainSurface,
  getTerrainMeshSize,
  sampleTrackPath,
} from '@/utils/terrainNoise'
import { planThemePark } from './layout'
import { ARCH_BOARD_HEIGHT, FLAG_DROP, RIDES } from './parkSpec'

const level = getLevelConfig('level1')!
const { varA, varB, varC, scalar } = level.track
const curve = createTrigCurve(varA, varB, varC, scalar)
const table = buildArcTable(curve)
const heightFn = createHeightFunction('themePark', sampleTrackPath((t) => curve.getPointAt(t)))
const groundFn = createTerrainSurface(heightFn, getTerrainMeshSize('themePark'))
const layout = planThemePark(table, heightFn, groundFn)
const eye = getTrackDimensions(level.track).eyeHeight

/** Track samples within `r` (XZ) of a point. */
function trackNear(x: number, z: number, r: number): number[] {
  const out: number[] = []
  for (let i = 0; i < table.count; i++) {
    if ((table.x[i] - x) ** 2 + (table.z[i] - z) ** 2 < r * r) out.push(i)
  }
  return out
}

/** Something hanging between yBottom and yTop must pass well above the rider or well below the track. */
function clearsRider(x: number, z: number, yBottom: number, yTop: number, r = 6) {
  for (const i of trackNear(x, z, r)) {
    const y = table.y[i]
    const above = yBottom >= y + eye + 8
    const below = yTop <= y - 10
    if (!above && !below) return false
  }
  return true
}

describe('theme park layout (level 1)', () => {
  it('lines the track with stalls, kept clear of rails and towers', () => {
    expect(layout.stalls.length).toBeGreaterThanOrEqual(40)
    for (const s of layout.stalls) expect(trackNear(s.x, s.z, 38)).toEqual([])
  })

  it('strings lights between poles that stand clear of the track', () => {
    expect(layout.lightWires.length).toBeGreaterThanOrEqual(20)
    expect(layout.bulbs.length / 3).toBeGreaterThanOrEqual(200)
    for (let k = 0; k < layout.bulbs.length; k += 3) {
      const [x, y, z] = layout.bulbs.slice(k, k + 3)
      expect(clearsRider(x, z, y, y, 10)).toBe(true)
    }
  })

  it('hangs bunting across the track above the rider', () => {
    expect(layout.buntingWires.length).toBeGreaterThanOrEqual(5)
    for (const f of layout.flags) expect(clearsRider(f.x, f.z, f.y - FLAG_DROP, f.y)).toBe(true)
    for (const p of [...layout.lightPoles, ...layout.buntingPoles]) expect(trackNear(p.x, p.z, 10)).toEqual([])
  })

  it('builds an entrance arch the rider passes under', () => {
    const arch = layout.arch!
    expect(arch).not.toBeNull()
    expect(clearsRider(arch.x, arch.z, arch.boardY, arch.boardY + ARCH_BOARD_HEIGHT, 40)).toBe(true)
  })

  it('keeps rides, tents and flag poles off the track', () => {
    for (const r of RIDES) expect(trackNear(r.x, r.z, r.radius)).toEqual([])
    for (const t of layout.tents) expect(trackNear(t.x, t.z, 40)).toEqual([])
    for (const p of layout.flagPoles) expect(trackNear(p.x, p.z, 12)).toEqual([])
  })

  it('lays a mostly open path between the rides', () => {
    const open = layout.path.filter((r) => r.open).length
    expect(open / layout.path.length).toBeGreaterThan(0.5)
  })

  it('is deterministic', () => {
    const again = planThemePark(table, heightFn, groundFn)
    expect(again.stalls).toEqual(layout.stalls)
    expect(again.bulbs).toEqual(layout.bulbs)
  })
})
