import { describe, expect, it } from 'vitest'
import { FLAME, PIECES, distanceToBox, piece, pieceBoxes } from './blockout'
import { FLAME_ISLAND, PATHS, onPath, subtractRects, type Rect } from './floorPaths'

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
    expect(piece('pad', 'pad-flame').rot).toBe(0)
  })
})
