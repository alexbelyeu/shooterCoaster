import type { ShadowCaster } from '../../shared/contactShadows'
import { GYM_SCALE, PIECES, PIT, floorAt, pieceBoxes, pieceToBlockout, toBlockout, toWorld, type BlockoutPiece, type PieceKind } from './blockout'
import { HIDDEN_PIECES } from './config'
import { PATHS, onPath, subtractRects, type Rect } from './floorPaths'

const DEG = Math.PI / 180

/** Penumbra (blockout metres) and darkness per kind of piece that stands on the floor. */
const SHADE: Partial<Record<PieceKind, { spread: number; strength: number; radius: number }>> = {
  block: { spread: 2, strength: 0.7, radius: 1 },
  tree: { spread: 2, strength: 0.7, radius: 0.5 },
  arch: { spread: 1.2, strength: 0.65, radius: 0.3 },
  sport: { spread: 1.2, strength: 0.5, radius: 0 },
  boulder: { spread: 1.2, strength: 0.55, radius: 0 },
  prop: { spread: 0.4, strength: 0.6, radius: 0.1 },
}

/** A box whose foot is this far (m) over the surface under it hangs off a wall (the hang boards, the Arch's lintel): no contact shadow. */
const FLOATING = 0.5

const pads = PIECES.filter((p): p is Extract<BlockoutPiece, { kind: 'pad' }> => p.kind === 'pad')

/** What a piece stands on at a blockout x/z: the floor, the top of the mats over it (the pit's, wall to wall), or a walkway cut through them. */
export function standingSurfaceAt(x: number, z: number): number {
  const floor = floorAt(x, z)
  if (floor < 0) return floor + PIT.mats
  if (onPath(x, z)) return floor
  let y = floor
  for (const pad of pads) {
    const dx = x - pad.x
    const dz = z - pad.z
    const r = pad.rot * DEG
    const along = dx * Math.cos(r) - dz * Math.sin(r)
    const facing = dx * Math.sin(r) + dz * Math.cos(r)
    if (Math.abs(along) <= pad.w / 2 && Math.abs(facing) <= pad.d / 2) y = Math.max(y, pad.base + pad.thick)
  }
  return y
}

/** `standingSurfaceAt` in world units: the shadows lie on the mats, not on the floor under them. */
function gymSurface(x: number, z: number): number {
  const p = toBlockout({ x, y: 0, z })
  return standingSurfaceAt(p.x, p.z) * GYM_SCALE
}

/**
 * A footprint's grid (blockout rect `r`) cut at the walkways' edges: the parts off them, then its part on each one. The
 * mats stop at a walkway's edge, so each part lies on one flat surface and no cell straddles the step for the deficit lift
 * to raise to the mats' top (#683). A rotated piece keeps one grid: no walkway reaches one's shadow.
 */
function gridPieces(r: Rect, rot: number): Rect[] {
  if (rot !== 0) return [r]
  const pieces = subtractRects(r, PATHS)
  PATHS.forEach((path, i) => {
    const on = { minX: Math.max(r.minX, path.minX), maxX: Math.min(r.maxX, path.maxX), minZ: Math.max(r.minZ, path.minZ), maxZ: Math.min(r.maxZ, path.maxZ) }
    if (on.minX < on.maxX && on.minZ < on.maxZ) pieces.push(...subtractRects(on, PATHS.slice(0, i)))
  })
  return pieces
}

/** Contact-shadow footprints of everything standing in the hall: walls, boulders, the Tree, the Arch's legs and the props (#544). */
export function gymShadowCasters(): ShadowCaster[] {
  const out: ShadowCaster[] = []
  for (const p of PIECES) {
    const shade = SHADE[p.kind]
    if (!shade || HIDDEN_PIECES.has(p.id)) continue
    for (const b of pieceBoxes(p)) {
      const centre = pieceToBlockout(p, (b.minA + b.maxA) / 2, (b.minF + b.maxF) / 2)
      if (b.minY > standingSurfaceAt(centre.x, centre.z) + FLOATING) continue
      const world = toWorld({ x: centre.x, y: 0, z: centre.z })
      const halfA = (b.maxA - b.minA) / 2
      const halfF = (b.maxF - b.minF) / 2
      const ex = halfA + shade.spread
      const ez = halfF + shade.spread
      for (const g of gridPieces({ minX: centre.x - ex, maxX: centre.x + ex, minZ: centre.z - ez, maxZ: centre.z + ez }, p.rot)) {
        out.push({
          x: world.x,
          z: world.z,
          halfX: halfA * GYM_SCALE,
          halfZ: halfF * GYM_SCALE,
          yaw: p.rot * DEG,
          radius: shade.radius * GYM_SCALE,
          spread: shade.spread * GYM_SCALE,
          strength: shade.strength,
          ground: gymSurface,
          grid: { minX: (g.minX - centre.x) * GYM_SCALE, maxX: (g.maxX - centre.x) * GYM_SCALE, minZ: (g.minZ - centre.z) * GYM_SCALE, maxZ: (g.maxZ - centre.z) * GYM_SCALE },
        })
      }
    }
  }
  return out
}
