import * as THREE from 'three'
import { createTrackCurve } from '@/track/curves/createTrackCurve'
import { buildJunction } from '@/track/junction'
import { PIECES, pieceBoxes, toBlockout, type Vec3 } from './blockout'
import { GYM_TRACK } from './gymTrack'

// Shared by the gym's geometry tests (`wallPanels.test.ts`, `treeTrunk.test.ts`, `gymTrack.test.ts`); nothing in the game imports it.

export const EPS = 1e-6

/** Vertices of a local triangle list as [along, up, facing]. */
export function vertices(positions: readonly number[]): [number, number, number][] {
  const out: [number, number, number][] = []
  for (let i = 0; i < positions.length; i += 3) out.push([positions[i], positions[i + 1], positions[i + 2]])
  return out
}

/** Vertices outside a piece's footprint box (its frame, from its foot); `sunk` lets them go that far under the floor. */
export function outsideBox(p: (typeof PIECES)[number], verts: [number, number, number][], sunk = 0): number {
  const [b] = pieceBoxes(p)
  return verts.filter(([a, y, f]) => a < b.minA - EPS || a > b.maxA + EPS || f < b.minF - EPS || f > b.maxF + EPS || y + p.base < b.minY - sunk - EPS || y + p.base > b.maxY + EPS).length
}

// The track in blockout metres, its junction's branch (#702) included, bucketed by 4 m cells for the clearance checks (built on first use).
const CELL = 4
/** Track samples about 0.15 m apart: a solid thinner than that (a 0.08 m railing) still lies within half of it of one. */
const SAMPLES = 5000
let cells: Map<string, Vec3[]> | undefined

function trackCells(): Map<string, Vec3[]> {
  if (cells) return cells
  const map = new Map<string, Vec3[]>()
  cells = map
  const curve = createTrackCurve(GYM_TRACK)
  const add = (w: Vec3) => {
    const p = toBlockout({ x: w.x, y: w.y, z: w.z })
    const key = `${Math.floor(p.x / CELL)},${Math.floor(p.y / CELL)},${Math.floor(p.z / CELL)}`
    map.set(key, [...(map.get(key) ?? []), p])
  }
  for (let i = 0; i < SAMPLES; i++) add(curve.getPointAt(i / SAMPLES))
  if (GYM_TRACK.junction) {
    const { from, to, branch } = buildJunction(curve, GYM_TRACK.junction)
    const n = Math.ceil(SAMPLES * (to - from) * 1.5)
    for (let i = 0; i <= n; i++) add(branch.getPointAt(i / n))
  }
  return map
}

/** Distance from a blockout point to the nearest sampled track point within a cell of it (Infinity if none). */
export function trackDistance(q: Vec3): number {
  let best = Infinity
  const [cx, cy, cz] = [q.x, q.y, q.z].map((v) => Math.floor(v / CELL))
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      for (let dz = -1; dz <= 1; dz++)
        for (const p of trackCells().get(`${cx + dx},${cy + dy},${cz + dz}`) ?? []) best = Math.min(best, Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z))
  return best
}

/** Where the track comes nearest a mesh: the distance in blockout metres and the centre of the triangle it nears. */
export interface Clearance {
  distance: number
  at: Vec3
}

/**
 * The track's clearance from every triangle of meshes in world units (the hall as `buildHall` draws it, every railing,
 * step and prop included). Each triangle's box, padded by `within` metres, picks the track samples it measures, so
 * nothing nearer than `within` reads Infinity.
 */
export function meshClearance(meshes: readonly THREE.BufferGeometry[], within: number): Clearance {
  const tri = new THREE.Triangle()
  const q = new THREE.Vector3()
  const closest = new THREE.Vector3()
  const box = new THREE.Box3()
  let best: Clearance = { distance: Infinity, at: { x: 0, y: 0, z: 0 } }
  for (const mesh of meshes) {
    const pos = mesh.attributes.position
    const index = mesh.index
    const count = index ? index.count : pos.count
    const vertex = (k: number, v: THREE.Vector3) => {
      const i = index ? index.getX(k) : k
      const b = toBlockout({ x: pos.getX(i), y: pos.getY(i), z: pos.getZ(i) })
      return v.set(b.x, b.y, b.z)
    }
    for (let k = 0; k < count; k += 3) {
      vertex(k, tri.a)
      vertex(k + 1, tri.b)
      vertex(k + 2, tri.c)
      box.setFromPoints([tri.a, tri.b, tri.c]).expandByScalar(within)
      const [x0, y0, z0] = [box.min.x, box.min.y, box.min.z].map((v) => Math.floor(v / CELL))
      const [x1, y1, z1] = [box.max.x, box.max.y, box.max.z].map((v) => Math.floor(v / CELL))
      for (let cx = x0; cx <= x1; cx++)
        for (let cy = y0; cy <= y1; cy++)
          for (let cz = z0; cz <= z1; cz++)
            for (const p of trackCells().get(`${cx},${cy},${cz}`) ?? []) {
              if (!box.containsPoint(q.set(p.x, p.y, p.z))) continue
              const d = tri.closestPointToPoint(q, closest).distanceTo(q)
              if (d < best.distance) best = { distance: d, at: { x: (tri.a.x + tri.b.x + tri.c.x) / 3, y: (tri.a.y + tri.b.y + tri.c.y) / 3, z: (tri.a.z + tri.b.z + tri.c.z) / 3 } }
            }
    }
  }
  return best
}
