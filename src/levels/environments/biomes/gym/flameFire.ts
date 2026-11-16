import { FLAME, GYM_SCALE, blockRings, footprint, piece, toWorld, type Vec3 } from './blockout'

/**
 * The Flame's fire (#520), laid out in the blockout's metres and scaled to the world: a skin of fire
 * lofted up its faces from the mats, a plume narrowing over its top where the tongues break up, the warm
 * pool its light throws on the mats, and the box its embers rise through. Pure: `FlameFire.tsx` draws it.
 */

/** Out from the Flame's faces, so the fire never z-fights its paint. */
export const SKIN = 0.15
/** Rings over the Flame's top: how far above it, and how far in from its top ring (the tongues narrow as they rise). */
const PLUME: readonly { rise: number; inset: number }[] = [
  { rise: 1.0, inset: 0.4 },
  { rise: 2.2, inset: 1.0 },
  { rise: 3.6, inset: 1.6 },
]

const DEG = Math.PI / 180
const pad = piece('pad', 'pad-flame')
/** The mats' top, where the fire starts and the light pool lies. */
export const PAD_TOP = pad.base + pad.thick

export interface FlameFireShell {
  /** World positions, `rings × (ring points + 1)` (each ring repeats its first point to close the seam). */
  positions: Float32Array
  /** Per vertex: metres round the Flame (0 → `perimeter`, the same on every ring) and world height. */
  fire: Float32Array
  indices: number[]
  /** World metres round the shell, where the fire's noise wraps. */
  perimeter: number
  /** World heights of the mats, the Flame's top and the plume's crest. */
  base: number
  top: number
  crest: number
}

function ringPerimeter(ring: readonly [number, number][]): number {
  let length = 0
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i]
    const [bx, bz] = ring[(i + 1) % ring.length]
    length += Math.hypot(bx - ax, bz - az)
  }
  return length
}

/** A Flame-local point (along its length, up, across) in world units. */
function worldPoint(x: number, y: number, z: number): Vec3 {
  const p = FLAME.piece
  const c = Math.cos(p.rot * DEG)
  const s = Math.sin(p.rot * DEG)
  return toWorld({ x: p.x + x * c + z * s, y: p.base + y, z: p.z - x * s + z * c })
}

/** The fire's skin and plume: one closed loft, from the mats up the Flame's faces to the crest over its top. */
export function buildFlameFireShell(): FlameFireShell {
  const p = FLAME.piece
  const faces = blockRings(p.profile)
  const top = faces[faces.length - 1]
  // From the mats' top (interpolating the face ring there), up the faces, then the plume
  const rings: { f: number; y: number }[] = []
  for (let k = 0; k + 1 < faces.length; k++) {
    const lo = faces[k]
    const hi = faces[k + 1]
    if (hi.y <= PAD_TOP) continue
    if (lo.y < PAD_TOP) rings.push({ f: lo.f + ((hi.f - lo.f) * (PAD_TOP - lo.y)) / (hi.y - lo.y), y: PAD_TOP })
    else rings.push(lo)
  }
  rings.push(top)
  for (const r of PLUME) rings.push({ f: top.f - r.inset, y: top.y + r.rise })

  const outlines = rings.map((r) => footprint(p.w / 2 + r.f + SKIN, p.d / 2 + r.f + SKIN, p.chamfer))
  const perimeter = ringPerimeter(outlines[outlines.length - 1]) * GYM_SCALE
  const n = outlines[0].length
  const positions = new Float32Array(rings.length * (n + 1) * 3)
  const fire = new Float32Array(rings.length * (n + 1) * 2)
  let v = 0
  rings.forEach((ring, k) => {
    const outline = outlines[k]
    const length = ringPerimeter(outline)
    let along = 0
    for (let i = 0; i <= n; i++) {
      const [x, z] = outline[i % n]
      if (i > 0) {
        const [px, pz] = outline[i - 1]
        along += Math.hypot(x - px, z - pz)
      }
      const w = worldPoint(x, ring.y, z)
      positions.set([w.x, w.y, w.z], v * 3)
      // Each ring's share of its own outline, so the tongues fan out with the flare instead of shearing
      fire.set([(along / length) * perimeter, w.y], v * 2)
      v++
    }
  })
  const indices: number[] = []
  for (let k = 0; k + 1 < rings.length; k++) {
    for (let i = 0; i < n; i++) {
      const a = k * (n + 1) + i
      const b = a + n + 1
      indices.push(a, a + 1, b + 1, a, b + 1, b)
    }
  }
  return {
    positions,
    fire,
    indices,
    perimeter,
    base: worldPoint(0, PAD_TOP, 0).y,
    top: worldPoint(0, top.y, 0).y,
    crest: worldPoint(0, rings[rings.length - 1].y, 0).y,
  }
}

/** Out past the Flame's flared footprint, the warm pool's edge on the mats (blockout metres). */
const POOL_REACH = 2.2

/** The light pool on the mats: an ellipse round the Flame's foot, just over the mats (world units). */
export function flamePool(): { centre: Vec3; halfX: number; halfZ: number } {
  return {
    centre: worldPoint(0, PAD_TOP + 0.02, 0),
    halfX: (FLAME.halfX + POOL_REACH) * GYM_SCALE,
    halfZ: (FLAME.halfZ + POOL_REACH) * GYM_SCALE,
  }
}

/** Where the embers' box sits: over the Flame's centre, its middle this far (blockout metres) up, as high as the spiral. */
const EMBER_MID_Y = 7.5

/** The anchor of the Flame's ember field (`PARTICLE_PRESETS.gymFlameEmbers`), world units. */
export function emberAnchor(): [number, number, number] {
  const c = worldPoint(0, EMBER_MID_Y, 0)
  return [c.x, c.y, c.z]
}
