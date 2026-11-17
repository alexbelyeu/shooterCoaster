import { createRng } from '@/utils/rng'
import { FLAME, GYM_SCALE, blockRings, footprint, piece, toWorld, type Vec3 } from './blockout'

/**
 * The Flame's fire (#520, rebuilt in #595), laid out in the blockout's metres and scaled to the world: the
 * tongues of flame that rise up its faces and off its top, the warm pool its light throws on the mats, and
 * the box its embers rise through. Pure: `FlameFire.tsx` draws it.
 *
 * Each tongue is one soft flame sprite on a path of three points that hugs the Flame (its start, a point
 * halfway and its end, each held out from the faces by half the tongue's width so it never cuts into the
 * paint), rising along it over a life of its own and coming back on a new path every life.
 */

const DEG = Math.PI / 180
const pad = piece('pad', 'pad-flame')
/** The mats' top, where the fire starts and the light pool lies. */
export const PAD_TOP = pad.base + pad.thick

/** Tongues at full quality on a desktop; `tongueCount` thins them. */
export const MAX_TONGUES = 260
/** Share of the tongues licking up the faces; the rest rise off the Flame's top. */
const FACE_SHARE = 0.72
/** How far over the Flame's top the tallest tongues reach (blockout metres). */
export const PLUME_RISE = 4.2

export interface FlameTongues {
  count: number
  /** Per tongue: the path's start (world xyz) and its heat (0..1). */
  start: Float32Array
  /** Per tongue: the path's middle and end (world xyz). */
  mid: Float32Array
  end: Float32Array
  /** Per tongue: phase (0..1), life (s), width (world units), seed (0..1). */
  params: Float32Array
}

/** A Flame-local point (along its length, up, across) in world units. */
function worldPoint(x: number, y: number, z: number): Vec3 {
  const p = FLAME.piece
  const c = Math.cos(p.rot * DEG)
  const s = Math.sin(p.rot * DEG)
  return toWorld({ x: p.x + x * c + z * s, y: p.base + y, z: p.z - x * s + z * c })
}

const RINGS = blockRings(FLAME.piece.profile)
const TOP = RINGS[RINGS.length - 1]

/** How far out from the foot's outline the Flame's faces are at height `y` (blockout metres). */
function faceOffset(y: number): number {
  for (let k = 0; k + 1 < RINGS.length; k++) {
    const lo = RINGS[k]
    const hi = RINGS[k + 1]
    if (y <= hi.y) return lo.f + ((hi.f - lo.f) * (Math.max(y, lo.y) - lo.y)) / (hi.y - lo.y)
  }
  return TOP.f
}

/** The point `s` (0..1 of the way round) on a footprint ring offset `f`, and its outward normal (Flame-local x/z). */
function outlinePoint(f: number, s: number): { x: number; z: number; nx: number; nz: number } {
  const p = FLAME.piece
  const ring = footprint(p.w / 2 + f, p.d / 2 + f, p.chamfer)
  const lengths = ring.map(([ax, az], i) => {
    const [bx, bz] = ring[(i + 1) % ring.length]
    return Math.hypot(bx - ax, bz - az)
  })
  let left = s * lengths.reduce((a, b) => a + b, 0)
  let i = 0
  while (i < ring.length - 1 && left > lengths[i]) left -= lengths[i++]
  const [ax, az] = ring[i]
  const [bx, bz] = ring[(i + 1) % ring.length]
  const t = left / lengths[i]
  const x = ax + (bx - ax) * t
  const z = az + (bz - az) * t
  // The edge's normal, turned to point away from the centre
  let nx = (bz - az) / lengths[i]
  let nz = -(bx - ax) / lengths[i]
  if (nx * x + nz * z < 0) [nx, nz] = [-nx, -nz]
  return { x, z, nx, nz }
}

/**
 * Where a tongue `s` of the way round is at height `y`, held `out` off the faces: on the faces up to the
 * Flame's top, then drawn in over it as the fire narrows into its plume.
 */
function firePoint(s: number, y: number, out: number): Vec3 {
  const above = Math.max(0, y - TOP.y)
  const o = outlinePoint(above > 0 ? TOP.f - Math.min(above * 0.55, 2.3) : faceOffset(y), s)
  const hold = above > 0 ? out * 0.4 : out
  return worldPoint(o.x + o.nx * hold, y, o.z + o.nz * hold)
}

/** A point over the Flame's top, `r` (0..1) of the way from its middle to its top ring, `rise` above it. */
function capPoint(s: number, r: number, rise: number): Vec3 {
  const o = outlinePoint(TOP.f - Math.min(rise * 0.4, 1.8), s)
  return worldPoint(o.x * r, TOP.y + rise, o.z * r)
}

/** The tongues, in a shuffled order so any first `n` of them are an even thinning (`tongueCount`). */
export function buildFlameTongues(count = MAX_TONGUES, seed = 0x5f1a3e): FlameTongues {
  const rng = createRng(seed)
  const start = new Float32Array(count * 4)
  const mid = new Float32Array(count * 3)
  const end = new Float32Array(count * 3)
  const params = new Float32Array(count * 4)
  const put = (into: Float32Array, i: number, stride: number, p: Vec3) => into.set([p.x, p.y, p.z], i * stride)
  for (let i = 0; i < count; i++) {
    const s = rng()
    const onFace = rng() < FACE_SHARE
    const width = onFace ? rng.range(1.1, 2.0) : rng.range(1.4, 2.5)
    const out = width * 0.55
    let heat: number
    if (onFace) {
      // Low licks at the foot to tall tongues up the flare and over the lip
      const y0 = rng.range(PAD_TOP, TOP.y - 0.4)
      const rise = rng.range(1.3, 2.8)
      put(start, i, 4, firePoint(s, y0, out))
      put(mid, i, 3, firePoint(s, y0 + rise / 2, out))
      put(end, i, 3, firePoint(s, y0 + rise, out))
      heat = rng.range(0.8, 1.0)
    } else {
      const r = rng.range(0.15, 0.95)
      const rise = rng.range(1.6, PLUME_RISE - 0.3)
      put(start, i, 4, capPoint(s, r, 0.3))
      put(mid, i, 3, capPoint(s, r * 0.85, 0.3 + rise / 2))
      put(end, i, 3, capPoint(s, r * 0.6, 0.3 + rise))
      heat = rng.range(0.6, 0.85)
    }
    start[i * 4 + 3] = heat
    params.set([rng(), rng.range(0.9, 1.7), width * GYM_SCALE, rng()], i * 4)
  }
  return { count, start, mid, end, params }
}

/** Tongues to draw: touch screens get half (as their particles), the graphics quality's `particleScale` thins them further. */
export function tongueCount(coarsePointer: boolean, particleScale: number, max = MAX_TONGUES): number {
  return Math.max(1, Math.round(max * (coarsePointer ? 0.5 : 1) * particleScale))
}

/** World heights of the mats, the Flame's top and the crest of its plume. */
export function fireHeights(): { base: number; top: number; crest: number } {
  return {
    base: worldPoint(0, PAD_TOP, 0).y,
    top: worldPoint(0, TOP.y, 0).y,
    crest: worldPoint(0, TOP.y + PLUME_RISE, 0).y,
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
