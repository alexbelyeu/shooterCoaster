import { describe, expect, it } from 'vitest'
import { createTrackCurve } from '@/track/curves/createTrackCurve'
import { PIECES, TREE_GAP, pieceBoxes, pieceToBlockout, piece, toBlockout, treeHeadLean, treeSolidBoxes, type PieceOf, type Vec3 } from './blockout'
import { WALL_STYLE } from './config'
import { GYM_TRACK, RAIL_CLEARANCE } from './gymTrack'
import { buildTreeWood } from './treeTrunk'
import { FACE, buildWallPanels, wallSpec, type WallPanels } from './wallPanels'

const EPS = 1e-6
const walls = PIECES.filter((p): p is PieceOf<'sport' | 'boulder'> => p.kind === 'sport' || p.kind === 'boulder')
const built = walls.map((p) => ({ p, wall: buildWallPanels(wallSpec(p, WALL_STYLE[p.id])) }))
const tree = piece('tree')
const wood = buildTreeWood(tree)
/** The caves' back wall and the headwall over them, built as `hallGeometry` builds them, in the Tree's frame. */
const caves = vertices(buildWallPanels({ length: tree.width, profile: [{ len: tree.caveHeight, angle: 0 }], back: 0.5, seed: 5191 }).positions)
const head = vertices(
  buildWallPanels({ length: tree.width, profile: [{ len: (tree.height - tree.caveHeight) / Math.cos((tree.headAngle * Math.PI) / 180), angle: tree.headAngle }], back: tree.caveDepth + 0.5, seed: 5192, bottom: true }).positions,
).map(([a, y, f]): [number, number, number] => [a, y + tree.caveHeight, f + tree.caveDepth])

/** Vertices of a local triangle list as [along, up, facing]. */
function vertices(positions: readonly number[]): [number, number, number][] {
  const out: [number, number, number][] = []
  for (let i = 0; i < positions.length; i += 3) out.push([positions[i], positions[i + 1], positions[i + 2]])
  return out
}

/** Vertices outside a piece's footprint box (its frame, from its foot); `sunk` lets them go that far under the floor. */
function outsideBox(p: (typeof PIECES)[number], verts: [number, number, number][], sunk = 0): number {
  const [b] = pieceBoxes(p)
  return verts.filter(([a, y, f]) => a < b.minA - EPS || a > b.maxA + EPS || f < b.minF - EPS || f > b.maxF + EPS || y + p.base < b.minY - sunk - EPS || y + p.base > b.maxY + EPS).length
}

// The track in blockout metres, bucketed by 4 m cells for the clearance check.
const curve = createTrackCurve(GYM_TRACK)
const CELL = 4
const cells = new Map<string, Vec3[]>()
for (let i = 0; i < 3000; i++) {
  const w = curve.getPointAt(i / 3000)
  const p = toBlockout({ x: w.x, y: w.y, z: w.z })
  const key = `${Math.floor(p.x / CELL)},${Math.floor(p.y / CELL)},${Math.floor(p.z / CELL)}`
  cells.set(key, [...(cells.get(key) ?? []), p])
}
function trackDistance(q: Vec3): number {
  let best = Infinity
  const [cx, cy, cz] = [q.x, q.y, q.z].map((v) => Math.floor(v / CELL))
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      for (let dz = -1; dz <= 1; dz++)
        for (const p of cells.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? []) best = Math.min(best, Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z))
  return best
}

/** The directions a wall's panel faces look, rounded: how rugged it is. */
function faceNormals(wall: WallPanels): Set<string> {
  const seen = new Set<string>()
  wall.part.forEach((part, t) => {
    if (part !== FACE) return
    const q = wall.positions.slice(t * 9, t * 9 + 9)
    const u = [q[3] - q[0], q[4] - q[1], q[5] - q[2]]
    const v = [q[6] - q[0], q[7] - q[1], q[8] - q[2]]
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    const l = Math.hypot(n[0], n[1], n[2])
    seen.add(n.map((x) => Math.round((x / l) * 10)).join())
  })
  return seen
}

describe('wallPanels: the rugged walls (#519)', () => {
  it('keeps every wall inside its footprint, with finite positions', () => {
    for (const { p, wall } of built) {
      expect(wall.positions.every(Number.isFinite), p.id).toBe(true)
      expect(outsideBox(p, vertices(wall.positions)), p.id).toBe(0)
    }
  })

  it('keeps every panel off the track by its rail clearance', () => {
    for (const { p, wall } of built) {
      const nearest = Math.min(
        ...vertices(wall.positions).map(([a, y, f]) => {
          const { x, z } = pieceToBlockout(p, a, f)
          return trackDistance({ x, y: y + p.base, z })
        }),
      )
      expect(nearest, p.id).toBeGreaterThanOrEqual(RAIL_CLEARANCE)
    }
  })

  it('breaks every face into many panels facing many ways, none of them a flat sheet', () => {
    for (const { p, wall } of built) {
      expect(wall.panels.length, p.id).toBeGreaterThan(4)
      expect(faceNormals(wall).size, p.id).toBeGreaterThan(Math.min(12, wall.panels.length))
      // Both triangles and quads.
      expect(wall.panels.some((i) => i.half >= 0) && wall.panels.some((i) => i.half < 0), p.id).toBe(true)
    }
  })

  it("gives the Shield its big bulge", () => {
    const shield = built.find((b) => b.p.id === 'w-shield')!
    const plain = buildWallPanels({ ...wallSpec(shield.p), bulge: undefined })
    // Its lower, upright panel (the overhang above already reaches the footprint's front).
    const reach = (w: WallPanels) => Math.max(...vertices(w.positions).filter(([, y]) => y > 2 && y < 5).map(([, , f]) => f))
    expect(reach(shield.wall) - reach(plain)).toBeGreaterThan(0.6)
  })

  it('is the same for a seed', () => {
    const p = walls[0]
    expect(buildWallPanels(wallSpec(p)).positions).toEqual(buildWallPanels(wallSpec(p)).positions)
  })
})

describe('the Tree (#519)', () => {
  it('keeps its wood inside its footprint, with finite positions', () => {
    expect(wood.positions.every(Number.isFinite)).toBe(true)
    expect(wood.tone).toHaveLength(wood.positions.length / 9)
    // The roots sink into the pit floor.
    expect(outsideBox(tree, vertices(wood.positions), 2)).toBe(0)
  })

  it('keeps its headwall and caves inside its footprint', () => {
    expect(outsideBox(tree, caves)).toBe(0)
    expect(outsideBox(tree, head)).toBe(0)
    expect(Math.max(...head.map(([, , f]) => f))).toBeLessThanOrEqual(tree.caveDepth + treeHeadLean(tree) + EPS)
  })

  it('keeps its wood, caves and headwall inside the solid boxes the ride is held off (#613)', () => {
    const boxes = treeSolidBoxes(tree)
    const inSome = ([a, y, f]: [number, number, number]) =>
      boxes.some((b) => a >= b.minA - EPS && a <= b.maxA + EPS && f >= b.minF - EPS && f <= b.maxF + EPS && y + tree.base >= b.minY - EPS && y + tree.base <= b.maxY + EPS)
    expect([...vertices(wood.positions), ...caves, ...head].filter((v) => !inSome(v))).toEqual([])
  })

  it('keeps its wood, caves and headwall off the track by its rail clearance (#613)', () => {
    const nearest = Math.min(
      ...[...vertices(wood.positions), ...caves, ...head].map(([a, y, f]) => {
        const { x, z } = pieceToBlockout(tree, a, f)
        return trackDistance({ x, y: y + tree.base, z })
      }),
    )
    expect(nearest).toBeGreaterThanOrEqual(RAIL_CLEARANCE)
  })

  it('has a gap under the trunk the coaster fits through, cave to cave', () => {
    const inGap = vertices(wood.positions).filter(([a, y, f]) => Math.abs(a) < TREE_GAP.halfAlong && f > TREE_GAP.minF && f < TREE_GAP.maxF && y > 0.7 && y < TREE_GAP.height)
    expect(inGap).toHaveLength(0)
    expect(TREE_GAP.maxF - TREE_GAP.minF).toBeGreaterThanOrEqual(2 * RAIL_CLEARANCE)
    expect(TREE_GAP.height).toBeGreaterThanOrEqual(2 * RAIL_CLEARANCE)
    // The trunk stands on its roots over the gap.
    expect(vertices(wood.positions).some(([a, y]) => Math.abs(a) < 1 && y > TREE_GAP.height && y < TREE_GAP.height + 0.5)).toBe(true)
  })
})
