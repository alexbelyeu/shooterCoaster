import { createTrackCurve } from '@/track/curves/createTrackCurve'
import { PIECES, pieceBoxes, toBlockout, type Vec3 } from './blockout'
import { GYM_TRACK } from './gymTrack'

// Shared by the gym's geometry tests (`wallPanels.test.ts`, `treeTrunk.test.ts`); nothing in the game imports it.

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

// The track in blockout metres, bucketed by 4 m cells for the clearance check (built on first use).
const CELL = 4
let cells: Map<string, Vec3[]> | undefined

function trackCells(): Map<string, Vec3[]> {
  if (cells) return cells
  cells = new Map()
  const curve = createTrackCurve(GYM_TRACK)
  for (let i = 0; i < 3000; i++) {
    const w = curve.getPointAt(i / 3000)
    const p = toBlockout({ x: w.x, y: w.y, z: w.z })
    const key = `${Math.floor(p.x / CELL)},${Math.floor(p.y / CELL)},${Math.floor(p.z / CELL)}`
    cells.set(key, [...(cells.get(key) ?? []), p])
  }
  return cells
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
