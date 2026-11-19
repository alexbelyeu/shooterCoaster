import { describe, expect, it } from 'vitest'
import { FLAME, PIECES, PIT, distanceToBox, piece, pieceBoxes } from './blockout'
import { FLAME_ISLAND, PATHS, onPath, padLayout, subtractRects, type Rect } from './floorPaths'

const area = (r: Rect) => (r.maxX - r.minX) * (r.maxZ - r.minZ)
const overlap = (a: Rect, b: Rect) => Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)) * Math.max(0, Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ))

/** Every point of a rect on a `step` m grid, inset off its edges. */
function samples(r: Rect, step = 0.25): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = []
  for (let x = r.minX + 0.05; x <= r.maxX - 0.05; x += step) for (let z = r.minZ + 0.05; z <= r.maxZ - 0.05; z += step) out.push({ x, z })
  return out
}

describe('subtractRects', () => {
  const r = { minX: 0, maxX: 4, minZ: 0, maxZ: 4 }

  it('cuts a hole out as disjoint pieces covering the rest', () => {
    const hole = { minX: 1, maxX: 2, minZ: -1, maxZ: 3 }
    const pieces = subtractRects(r, [hole])
    expect(pieces.reduce((s, p) => s + area(p), 0)).toBeCloseTo(area(r) - overlap(r, hole))
    expect(pieces.every((p) => overlap(p, hole) === 0)).toBe(true)
    pieces.forEach((a, i) => pieces.slice(i + 1).forEach((b) => expect(overlap(a, b)).toBe(0)))
  })

  it('keeps a rect no hole touches whole, and drops one a hole covers', () => {
    expect(subtractRects(r, [{ minX: 5, maxX: 6, minZ: 0, maxZ: 1 }])).toEqual([r])
    expect(subtractRects(r, [{ minX: -1, maxX: 5, minZ: -1, maxZ: 5 }])).toEqual([])
  })
})

describe('the walkways', () => {
  it('ring the Flame outside its flared overhang', () => {
    const margin = 0.5
    expect(FLAME_ISLAND.minX).toBeLessThan(FLAME.centre.x - FLAME.halfX - margin)
    expect(FLAME_ISLAND.maxX).toBeGreaterThan(FLAME.centre.x + FLAME.halfX + margin)
    expect(FLAME_ISLAND.minZ).toBeLessThan(FLAME.centre.z - FLAME.halfZ - margin)
    expect(FLAME_ISLAND.maxZ).toBeGreaterThan(FLAME.centre.z + FLAME.halfZ + margin)
    const ring = PATHS.slice(0, 4)
    expect(ring.reduce((s, r) => s + area(r), 0)).toBeCloseTo(area({ minX: PATHS[0].minX, maxX: PATHS[0].maxX, minZ: PATHS[0].minZ, maxZ: PATHS[1].maxZ }) - area(FLAME_ISLAND))
  })

  it('join the entry floor inside the glass doors to the ring', () => {
    // Flood the walkways on a 0.25 m grid from the entry floor's edge.
    const step = 0.25
    const entry = piece('pad', 'entry-mat')
    const start = PATHS.flatMap((r) => samples(r, step)).find((p) => p.x > entry.x - entry.w / 2)
    expect(start).toBeDefined()
    const key = (p: { x: number; z: number }) => `${Math.round(p.x / step)},${Math.round(p.z / step)}`
    const seen = new Set([key(start!)])
    const queue = [start!]
    while (queue.length) {
      const p = queue.pop()!
      for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
        const q = { x: p.x + dx, z: p.z + dz }
        if (!onPath(q.x, q.z) || seen.has(key(q))) continue
        seen.add(key(q))
        queue.push(q)
      }
    }
    for (const r of PATHS) expect(samples(r, 1).every((p) => seen.has(key({ x: Math.round(p.x / step) * step, z: Math.round(p.z / step) * step })))).toBe(true)
  })

  it('cross no wall, boulder, prop or rope zone, only the Flame’s mats (cut back round them) and the entry floor', () => {
    const allowed = new Set(['pad-flame', 'entry-mat'])
    const standing = PIECES.filter((p) => p.kind !== 'floor' && p.kind !== 'pit' && !allowed.has(p.id)).flatMap((p) => pieceBoxes(p))
    const hits = PATHS.flatMap((r) => samples(r)).filter((p) => standing.some((b) => distanceToBox(b, { x: p.x, y: 0.1, z: p.z }) === 0))
    expect(hits).toEqual([])
  })

  it('cross only unrotated pads (`padLayout` cuts nothing out of a rotated one)', () => {
    const crossed = PIECES.filter((p) => p.kind === 'pad').filter((p) => {
      const r = (p.rot * Math.PI) / 180
      const hx = Math.abs((p.w / 2) * Math.cos(r)) + Math.abs((p.d / 2) * Math.sin(r))
      const hz = Math.abs((p.w / 2) * Math.sin(r)) + Math.abs((p.d / 2) * Math.cos(r))
      const bound = { minX: p.x - hx, maxX: p.x + hx, minZ: p.z - hz, maxZ: p.z + hz }
      return PATHS.some((path) => overlap(path, bound) > 0)
    })
    expect(crossed.map((p) => p.id)).toContain('pad-flame')
    expect(crossed.filter((p) => p.rot !== 0).map((p) => p.id)).toEqual([])
  })
})

describe('padLayout', () => {
  const flame = padLayout(piece('pad', 'pad-flame'))
  const tiles = flame.tiles.flat()
  const eps = 1e-6
  const spanOverlap = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0) > eps

  it('cuts the Flame’s mats into an island with the ring round it', () => {
    expect(tiles.length).toBeGreaterThan(0)
    const local = (r: Rect, p = piece('pad', 'pad-flame')) => ({ minX: r.minX + p.x, maxX: r.maxX + p.x, minZ: r.minZ + p.z, maxZ: r.maxZ + p.z })
    for (const r of [...flame.base, ...tiles].map((q) => local(q))) for (const path of PATHS) expect(overlap(r, path)).toBeCloseTo(0, 9)
  })

  it('leaves no tile side in the plane of an underlay side, cut edges included (they z-fight in one mesh)', () => {
    const shared: string[] = []
    for (const t of tiles) {
      for (const b of flame.base) {
        for (const x of [t.minX, t.maxX]) if ((Math.abs(x - b.minX) < eps || Math.abs(x - b.maxX) < eps) && spanOverlap(t.minZ, t.maxZ, b.minZ, b.maxZ)) shared.push(`x=${x}`)
        for (const z of [t.minZ, t.maxZ]) if ((Math.abs(z - b.minZ) < eps || Math.abs(z - b.maxZ) < eps) && spanOverlap(t.minX, t.maxX, b.minX, b.maxX)) shared.push(`z=${z}`)
      }
    }
    expect(shared).toEqual([])
  })
})

describe('the pit benches', () => {
  it('sit on the pit’s mats', () => {
    const benches = PIECES.filter((p) => p.id.startsWith('p-pitblock'))
    expect(benches.length).toBe(3)
    for (const b of benches) expect(b.kind === 'prop' && b.base).toBeCloseTo(PIT.floorY + PIT.mats)
  })
})
