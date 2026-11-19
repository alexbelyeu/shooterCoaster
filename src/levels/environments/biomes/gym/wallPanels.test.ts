import { describe, expect, it } from 'vitest'
import { PIECES, pieceToBlockout, type PieceOf } from './blockout'
import { WALL_STYLE } from './config'
import { outsideBox, trackDistance, vertices } from './geometryChecks'
import { RAIL_CLEARANCE } from './gymTrack'
import { FACE, buildWallPanels, wallSpec, type WallPanels } from './wallPanels'

const walls = PIECES.filter((p): p is PieceOf<'sport' | 'boulder'> => p.kind === 'sport' || p.kind === 'boulder')
const built = walls.map((p) => ({ p, wall: buildWallPanels(wallSpec(p, WALL_STYLE[p.id])) }))

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
