import { piece } from './blockout'

/**
 * The gym's black walkways (#668, pure): flat, unpadded floor from the entrance to the Flame and round it, laid
 * as axis-aligned rects in blockout metres. The floor shader (`grimeShader.ts`) paints them black on the main
 * floor and leaves its padded mats elsewhere; the Flame's raised mats (`pad-flame`) are cut back round them
 * (`hallGeometry.ts` `pad`), so the path lies at floor level between the mats' edges, never on top of them.
 */

export interface Rect {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/** A walkway's width (m). */
export const PATH_WIDTH = 1.5

const flamePads = piece('pad', 'pad-flame')
const entry = piece('pad', 'entry-mat')
const slabPads = piece('pad', 'pad-slab')

/** The ring round the Flame: along the inside of its mats' edge, so the mats under the Flame are an island in it. */
const ring: Rect = {
  minX: flamePads.x - flamePads.w / 2,
  maxX: flamePads.x + flamePads.w / 2,
  minZ: flamePads.z - flamePads.d / 2,
  maxZ: flamePads.z + flamePads.d / 2,
}

/** The ring's inner edge: the mats left round the Flame. */
export const FLAME_ISLAND: Rect = {
  minX: ring.minX + PATH_WIDTH,
  maxX: ring.maxX - PATH_WIDTH,
  minZ: ring.minZ + PATH_WIDTH,
  maxZ: ring.maxZ - PATH_WIDTH,
}

/** The Slab's mats' east edge, which the entrance path runs along, and the entry floor's north edge, where it starts. */
const slabEdge = slabPads.z - slabPads.d / 2
const entryInner = entry.x - entry.w / 2

/**
 * Every walkway rect: the ring's four sides, then the entrance path: from under the entry floor inside the glass
 * doors, north along the Slab's mats, then across to the ring's south-west corner.
 */
export const PATHS: readonly Rect[] = [
  { minX: ring.minX, maxX: ring.maxX, minZ: ring.minZ, maxZ: FLAME_ISLAND.minZ },
  { minX: ring.minX, maxX: ring.maxX, minZ: FLAME_ISLAND.maxZ, maxZ: ring.maxZ },
  { minX: ring.minX, maxX: FLAME_ISLAND.minX, minZ: FLAME_ISLAND.minZ, maxZ: FLAME_ISLAND.maxZ },
  { minX: FLAME_ISLAND.maxX, maxX: ring.maxX, minZ: FLAME_ISLAND.minZ, maxZ: FLAME_ISLAND.maxZ },
  { minX: FLAME_ISLAND.maxX, maxX: entryInner + 2, minZ: slabEdge - PATH_WIDTH, maxZ: slabEdge },
  { minX: FLAME_ISLAND.maxX, maxX: ring.maxX, minZ: ring.maxZ, maxZ: slabEdge - PATH_WIDTH },
]

const overlaps = (a: Rect, b: Rect) => a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ

/** Whether a blockout x/z is on a walkway. */
export function onPath(x: number, z: number): boolean {
  return PATHS.some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ)
}

/** `r` minus every rect in `holes`, as disjoint rects (each hole splits a piece into at most four). */
export function subtractRects(r: Rect, holes: readonly Rect[]): Rect[] {
  let pieces = [r]
  for (const h of holes) {
    const next: Rect[] = []
    for (const p of pieces) {
      if (!overlaps(p, h)) {
        next.push(p)
        continue
      }
      if (p.minX < h.minX) next.push({ ...p, maxX: h.minX })
      if (h.maxX < p.maxX) next.push({ ...p, minX: h.maxX })
      const minX = Math.max(p.minX, h.minX)
      const maxX = Math.min(p.maxX, h.maxX)
      if (p.minZ < h.minZ) next.push({ minX, maxX, minZ: p.minZ, maxZ: h.minZ })
      if (h.maxZ < p.maxZ) next.push({ minX, maxX, minZ: h.maxZ, maxZ: p.maxZ })
    }
    pieces = next
  }
  return pieces
}
