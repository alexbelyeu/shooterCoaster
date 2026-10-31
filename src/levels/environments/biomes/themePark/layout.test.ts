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
import { ARCH_BOARD_HEIGHT, FLAG_DROP, RIDES, STALL_DEPTH, STALL_WIDTH } from './parkSpec'

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

interface Footprint {
  kind: string
  x: number
  z: number
  r: number
  /** Stalls only: checked as their rectangle against round props. */
  yaw?: number
}

const STALL_HALF_DIAGONAL = Math.hypot(STALL_WIDTH, STALL_DEPTH) / 2

/** Sizes as drawn in Decorations.tsx / Midway.tsx. */
function footprints(): Footprint[] {
  const round = (kind: string, r: number) => (p: { x: number; z: number }) => ({ kind, x: p.x, z: p.z, r })
  return [
    ...RIDES.map((r) => ({ kind: r.kind, x: r.x, z: r.z, r: r.radius })),
    ...layout.stalls.map((s) => ({ kind: 'stall', x: s.x, z: s.z, r: STALL_HALF_DIAGONAL, yaw: s.yaw })),
    ...layout.tents.map(round('tent', 25)),
    ...layout.hedges.map(round('hedge', 9)),
    ...layout.lightPoles.map(round('light pole', 1)),
    ...layout.buntingPoles.map(round('bunting pole', 1)),
    ...layout.flagPoles.map(round('flag pole', 1)),
  ]
}

function overlaps(a: Footprint, b: Footprint): boolean {
  const stall = a.yaw !== undefined ? a : b
  const disc = stall === a ? b : a
  if (stall.yaw === undefined || disc.yaw !== undefined) return Math.hypot(a.x - b.x, a.z - b.z) < a.r + b.r
  // Inverse of layout.ts pushLocal: the disc's centre in the stall's frame.
  const c = Math.cos(stall.yaw)
  const s = Math.sin(stall.yaw)
  const dx = disc.x - stall.x
  const dz = disc.z - stall.z
  const lx = dx * c - dz * s
  const lz = dx * s + dz * c
  const ex = lx - Math.max(-STALL_WIDTH / 2, Math.min(STALL_WIDTH / 2, lx))
  const ez = lz - Math.max(-STALL_DEPTH / 2, Math.min(STALL_DEPTH / 2, lz))
  return Math.hypot(ex, ez) < disc.r
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

  it('never stands one prop on another', () => {
    const all = footprints()
    const clashes: string[] = []
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i]
        const b = all[j]
        if (overlaps(a, b)) clashes.push(`${a.kind} (${a.x.toFixed(0)}, ${a.z.toFixed(0)}) on ${b.kind} (${b.x.toFixed(0)}, ${b.z.toFixed(0)})`)
      }
    }
    expect(clashes).toEqual([])
  })

  it('turns the long side (local x) of each boundary hedge along its ring, not at the centre', () => {
    expect(layout.hedges.length).toBeGreaterThanOrEqual(20)
    for (const h of layout.hedges) {
      const radial = (h.x * Math.cos(h.yaw) - h.z * Math.sin(h.yaw)) / Math.hypot(h.x, h.z)
      expect(Math.abs(radial)).toBeLessThan(1e-6)
    }
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
