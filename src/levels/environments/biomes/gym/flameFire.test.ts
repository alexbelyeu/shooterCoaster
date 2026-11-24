import { describe, expect, it } from 'vitest'
import { FLAME, GYM_SCALE, HALL, blockRings, footprint, toBlockout, type Vec3 } from './blockout'
import {
  FLAME_EMBERS,
  FIRE_FLOOR,
  FLAME_TOP,
  MAX_SMOKE_PUFFS,
  MAX_TONGUES,
  PAD_TOP,
  PLUME_RISE,
  SMOKE_CEILING,
  buildFlameTongues,
  buildSmokePuffs,
  emberAnchor,
  fireFlicker,
  fireFootprint,
  fireHeights,
  fireLightSource,
  shimmerColumn,
  smokeCount,
  tongueCount,
} from './flameFire'

const tongues = buildFlameTongues()
const heights = fireHeights()
const points = (into: Float32Array, stride: number): Vec3[] =>
  Array.from({ length: tongues.count }, (_, i) => ({ x: into[i * stride], y: into[i * stride + 1], z: into[i * stride + 2] }))
const paths = [points(tongues.start, 4), points(tongues.mid, 3), points(tongues.end, 3)]

const rings = blockRings(FLAME.piece.profile)
/** How far a blockout point is outside the Flame's faces at its height (negative: inside the rock). */
function clearance(p: Vec3): number {
  const top = rings[rings.length - 1]
  if (p.y > top.y) return Infinity
  const k = rings.findIndex((r, i) => i > 0 && p.y <= r.y)
  const lo = rings[k - 1]
  const hi = rings[k]
  const f = lo.f + ((hi.f - lo.f) * (p.y - lo.y)) / (hi.y - lo.y)
  const ring = footprint(FLAME.piece.w / 2 + f, FLAME.piece.d / 2 + f, FLAME.piece.chamfer)
  const x = p.x - FLAME.centre.x
  const z = p.z - FLAME.centre.z
  // The ring is convex: outside it by the furthest of its edges' signed distances
  let out = -Infinity
  ring.forEach(([ax, az], i) => {
    const [bx, bz] = ring[(i + 1) % ring.length]
    const len = Math.hypot(bx - ax, bz - az)
    let nx = (bz - az) / len
    let nz = -(bx - ax) / len
    if (nx * ax + nz * az < 0) [nx, nz] = [-nx, -nz]
    out = Math.max(out, (x - ax) * nx + (z - az) * nz)
  })
  return out
}

describe('the Flame fire', () => {
  it('lays out finite tongues with lives, widths and seeds in range', () => {
    expect(tongues.count).toBe(MAX_TONGUES)
    expect([...tongues.start, ...tongues.mid, ...tongues.end, ...tongues.params].every(Number.isFinite)).toBe(true)
    for (let i = 0; i < tongues.count; i++) {
      const [phase, life, width, seed] = tongues.params.subarray(i * 4, i * 4 + 4)
      expect(phase).toBeGreaterThanOrEqual(0)
      expect(phase).toBeLessThan(1)
      expect(life).toBeGreaterThan(0.5)
      expect(width).toBeGreaterThan(GYM_SCALE)
      expect(seed).toBeLessThan(1)
      const heat = tongues.start[i * 4 + 3]
      expect(heat).toBeGreaterThan(0)
      expect(heat).toBeLessThanOrEqual(1)
    }
  })

  it('rises: every tongue from the Flame top or the bevel up to it, upwards, none past the crest', () => {
    expect(heights.base).toBeCloseTo(PAD_TOP * GYM_SCALE, 5)
    expect(heights.top).toBeCloseTo(FLAME.top * GYM_SCALE, 5)
    let lowest = Infinity
    let highest = -Infinity
    for (let i = 0; i < tongues.count; i++) {
      expect(paths[1][i].y).toBeGreaterThan(paths[0][i].y)
      expect(paths[2][i].y).toBeGreaterThan(paths[1][i].y)
      lowest = Math.min(lowest, paths[0][i].y)
      highest = Math.max(highest, paths[2][i].y)
    }
    expect(lowest).toBeGreaterThanOrEqual(FIRE_FLOOR * GYM_SCALE - 1e-3)
    expect(lowest).toBeLessThan(FIRE_FLOOR * GYM_SCALE + GYM_SCALE)
    expect(highest).toBeLessThanOrEqual(heights.crest + 1e-3)
    expect(highest).toBeGreaterThan(heights.top + 2 * GYM_SCALE)
  })

  it('burns as tall again as the Flame, with licks torn off the plume rising free over it (#669)', () => {
    expect(PLUME_RISE).toBeGreaterThan(FLAME.top)
    const tallest = Math.max(...paths[2].map((p) => p.y))
    expect(tallest).toBeGreaterThan(heights.top + 0.85 * PLUME_RISE * GYM_SCALE)
    const licks = paths[0].filter((p) => p.y > heights.top + 0.3 * PLUME_RISE * GYM_SCALE).length
    expect(licks / tongues.count).toBeGreaterThan(0.05)
    expect(licks / tongues.count).toBeLessThan(0.25)
  })

  it('burns only from the top: nothing starts down the faces or hangs under the overhang (#927)', () => {
    const lip = rings.reduce((a, b) => (b.f > a.f ? b : a))
    expect(lip.y).toBeGreaterThan(rings[1].y)
    expect(FIRE_FLOOR).toBeGreaterThan(lip.y)
    expect(FIRE_FLOOR).toBeLessThan(FLAME_TOP.y)
    const lowest = Math.min(...paths.flatMap((path) => path.map((p) => p.y)))
    expect(lowest).toBeGreaterThanOrEqual(FIRE_FLOOR * GYM_SCALE - 1e-3)
  })

  it('holds every tongue off the Flame faces, by over a third of its width', () => {
    let worst = Infinity
    for (let i = 0; i < tongues.count; i++) {
      const width = tongues.params[i * 4 + 2] / GYM_SCALE
      for (const path of paths) worst = Math.min(worst, clearance(toBlockout(path[i])) / width)
    }
    expect(worst).toBeGreaterThan(0.35)
  })

  it('burns all the way round the Flame', () => {
    const quadrants = new Set(paths[0].map((p) => {
      const b = toBlockout(p)
      return `${Math.sign(b.x - FLAME.centre.x)}${Math.sign(b.z - FLAME.centre.z)}`
    }))
    expect(quadrants.size).toBe(4)
  })

  it('thins on touch screens and lower quality, never to nothing', () => {
    expect(tongueCount(false, 1)).toBe(MAX_TONGUES)
    expect(tongueCount(true, 1)).toBe(MAX_TONGUES / 2)
    expect(tongueCount(false, 0.5)).toBeLessThan(tongueCount(false, 0.75))
    expect(tongueCount(true, 0.001)).toBe(1)
  })

  it('bounds the fire round the Flame foot, just over the mats', () => {
    const ground = fireFootprint()
    expect(ground.centre.y).toBeGreaterThan(PAD_TOP * GYM_SCALE)
    expect(ground.centre.y).toBeLessThan(PAD_TOP * GYM_SCALE + 1)
    expect(ground.halfX).toBeGreaterThan(FLAME.halfX * GYM_SCALE)
    expect(ground.halfZ).toBeGreaterThan(FLAME.halfZ * GYM_SCALE)
  })

  it('lights from inside the Flame, from low on its faces to over its top', () => {
    const light = fireLightSource()
    expect(light.x).toBe(FLAME.piece.x)
    expect(light.z).toBe(FLAME.piece.z)
    expect(light.minY).toBeGreaterThan(PAD_TOP)
    expect(light.maxY).toBeGreaterThan(FLAME_TOP.y)
    expect(light.halfLength).toBeLessThan(FLAME_TOP.halfLength)
  })

  it('shimmers the air from just over the top of the Flame up the plume, wider than its top, under the roof', () => {
    const corners = shimmerColumn()
    expect(corners).toHaveLength(24)
    const ys = Array.from({ length: 8 }, (_, i) => corners[i * 3 + 1])
    const top = toBlockout({ x: 0, y: Math.min(...ys), z: 0 }).y - FLAME.piece.base
    const crest = toBlockout({ x: 0, y: Math.max(...ys), z: 0 }).y - FLAME.piece.base
    expect(top).toBeGreaterThan(FLAME_TOP.y)
    expect(top).toBeLessThan(FLAME_TOP.y + 1)
    expect(crest).toBeGreaterThan(top + 5)
    expect(crest).toBeLessThanOrEqual(SMOKE_CEILING + 1e-6)
    const bottom = Array.from({ length: 4 }, (_, i) => toBlockout({ x: corners[i * 3], y: 0, z: corners[i * 3 + 2] }))
    const across = Math.hypot(bottom[0].x - bottom[1].x, bottom[0].z - bottom[1].z)
    expect(across).toBeGreaterThan(FLAME_TOP.halfLength * 2)
    expect(Number.isFinite(corners.reduce((a, b) => a + b, 0))).toBe(true)
  })

  it('flickers between half and full light, never steady', () => {
    const samples = Array.from({ length: 6000 }, (_, i) => fireFlicker(i / 60))
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0.5)
    expect(Math.max(...samples)).toBeLessThanOrEqual(1)
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.3)
    const steps = samples.slice(1).map((v, i) => Math.abs(v - samples[i]))
    expect(Math.max(...steps)).toBeLessThan(0.08)
    expect(steps.filter((d) => d < 1e-4).length).toBeLessThan(samples.length / 50)
  })

  it('raises smoke off the plume to under the roof, growing as it rises', () => {
    const puffs = buildSmokePuffs()
    const finite = [...puffs.start, ...puffs.end, ...puffs.params].every(Number.isFinite)
    let rises = true
    let grows = true
    let underRoof = true
    for (let i = 0; i < puffs.count; i++) {
      const from = puffs.start[i * 4 + 1]
      const to = puffs.end[i * 3 + 1]
      rises &&= from > heights.top && to > from
      underRoof &&= to < HALL.h * GYM_SCALE
      grows &&= puffs.params[i * 4 + 3] > puffs.params[i * 4 + 2]
    }
    expect({ finite, rises, grows, underRoof }).toEqual({ finite: true, rises: true, grows: true, underRoof: true })
    expect(SMOKE_CEILING).toBeLessThan(HALL.h)
    expect(smokeCount(false, 1)).toBe(MAX_SMOKE_PUFFS)
    expect(smokeCount(true, 1)).toBe(MAX_SMOKE_PUFFS / 2)
  })

  it('anchors rising embers over the Flame, their box covering its footprint and reaching from its flare to above the crest', () => {
    const [x, y, z] = emberAnchor()
    const c = toBlockout({ x, y, z })
    expect(c.x).toBeCloseTo(FLAME.centre.x, 5)
    expect(c.z).toBeCloseTo(FLAME.centre.z, 5)
    const { box, primary, secondary } = FLAME_EMBERS
    const ground = fireFootprint()
    expect(box[0] / 2).toBeGreaterThanOrEqual(ground.halfX)
    expect(box[2] / 2).toBeGreaterThanOrEqual(ground.halfZ)
    expect(y - box[1] / 2).toBeLessThan(heights.top)
    expect(y + box[1] / 2).toBeGreaterThan(heights.crest)
    for (const layer of [primary, secondary]) {
      // Up through the plume in a few seconds at any GYM_SCALE: the rise, in blockout metres a second
      expect(layer.velocity[1] / GYM_SCALE).toBeGreaterThan(0.5)
      expect(layer.velocity[1] / GYM_SCALE).toBeLessThan(2)
      expect(layer.additive).toBe(true)
      expect(layer.opacity * layer.maxPixels).toBeLessThanOrEqual(3.6)
    }
    expect(FLAME_EMBERS.count).toBeLessThanOrEqual(4000)
  })
})
