import { particleShare } from '@/canvas/graphicsQuality'
import { createRng } from '@/utils/rng'
import { smoothNoise1 } from '@/utils/valueNoise.hot'
import type { ParticleFieldPreset } from '../../shared/types'
import { FLAME, GYM_SCALE, HALL, blockRings, footprint, piece, toWorld, type Vec3 } from './blockout'

/**
 * The Flame's fire (#520, rebuilt in #595), laid out in the blockout's metres and scaled to the world: the
 * tongues of flame that rise up its faces and off its top, where its light comes from and how it flickers, the
 * smoke rising off it, and the box its embers rise through. Pure: `FlameFire.tsx` draws it.
 *
 * Each tongue is one soft flame sprite on a path of three points that hugs the Flame (its start, a point
 * halfway and its end, each held out from the faces by half the tongue's width so it never cuts into the
 * paint), rising along it over a life of its own and coming back on a new path every life.
 */

const DEG = Math.PI / 180
const pad = piece('pad', 'pad-flame')
/** The mats' top, where the fire starts. */
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
  return Math.max(1, Math.round(max * particleShare(coarsePointer, particleScale)))
}

/** World heights of the mats, the Flame's top and the crest of its plume. */
export function fireHeights(): { base: number; top: number; crest: number } {
  return {
    base: worldPoint(0, PAD_TOP, 0).y,
    top: worldPoint(0, TOP.y, 0).y,
    crest: worldPoint(0, TOP.y + PLUME_RISE, 0).y,
  }
}

/** Out past the Flame's flared footprint, how far the fire's bounds reach (blockout metres). */
const FOOTPRINT_REACH = 2.2

/** The ground the fire stands on: an ellipse round the Flame's foot, just over the mats (world units). */
export function fireFootprint(): { centre: Vec3; halfX: number; halfZ: number } {
  return {
    centre: worldPoint(0, PAD_TOP + 0.02, 0),
    halfX: (FLAME.halfX + FOOTPRINT_REACH) * GYM_SCALE,
    halfZ: (FLAME.halfZ + FOOTPRINT_REACH) * GYM_SCALE,
  }
}

/** The fire's light (#599): a segment through the Flame's middle (blockout metres, its frame turned `rot` degrees) the grime shader lights from. */
export function fireLightSource(): { x: number; z: number; rot: number; halfLength: number; minY: number; maxY: number } {
  const p = FLAME.piece
  return { x: p.x, z: p.z, rot: p.rot, halfLength: p.w / 2, minY: PAD_TOP + 1, maxY: TOP.y + PLUME_RISE * 0.4 }
}

/** The Flame's top in its own frame (blockout metres). */
export const FLAME_TOP = { y: TOP.y, halfLength: FLAME.piece.w / 2 + TOP.f, halfWidth: FLAME.piece.d / 2 + TOP.f }

/** The fire's light at time `t` (s), 0.5..1: a slow breathing under a quicker flicker, never steady, never out. */
export function fireFlicker(t: number): number {
  return 0.77 + 0.14 * smoothNoise1(t * 4.3, 1) + 0.07 * smoothNoise1(t * 11.9, 2) + 0.02 * smoothNoise1(t * 23.1, 3)
}

/** How far out past the Flame's top (blockout metres) the air over it shimmers. */
const SHIMMER_REACH = 1
/** How high over the Flame's top (blockout metres) the shimmer's column reaches: past the tongues, fading up the plume. */
const SHIMMER_RISE = PLUME_RISE * 2.5

/** The box of air over the Flame that the heat shimmer wavers (#627): its eight corners, world xyz, bottom four first. */
export function shimmerColumn(): Float32Array {
  const corners = new Float32Array(24)
  const hx = FLAME_TOP.halfLength + SHIMMER_REACH
  const hz = FLAME_TOP.halfWidth + SHIMMER_REACH
  const y1 = Math.min(TOP.y + SHIMMER_RISE, SMOKE_CEILING)
  let i = 0
  for (const y of [TOP.y + 0.5, y1]) {
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const c = worldPoint(sx * hx, y, sz * hz)
      corners.set([c.x, c.y, c.z], i)
      i += 3
    }
  }
  return corners
}

/** Smoke puffs at full quality on a desktop; `smokeCount` thins them. */
export const MAX_SMOKE_PUFFS = 40
/** How high the smoke rises (blockout metres): under the roof trusses, where it spreads and hangs. */
export const SMOKE_CEILING = HALL.h - 6

export interface SmokePuffs {
  count: number
  /** Per puff: where it rises from (world xyz) and its darkness (0..1). */
  start: Float32Array
  /** Per puff: where its life ends (world xyz). */
  end: Float32Array
  /** Per puff: phase (0..1), life (s), size at the start and at the end (world units). */
  params: Float32Array
}

/** Smoke rising off the plume's crest, spreading and slowing as it climbs to hang under the roof; shuffled like the tongues. */
export function buildSmokePuffs(count = MAX_SMOKE_PUFFS, seed = 0x5a0e7): SmokePuffs {
  const rng = createRng(seed)
  const start = new Float32Array(count * 4)
  const end = new Float32Array(count * 3)
  const params = new Float32Array(count * 4)
  const crest = TOP.y + PLUME_RISE * 0.6
  for (let i = 0; i < count; i++) {
    const along = rng.range(-0.4, 0.4) * FLAME.piece.w
    const from = worldPoint(along, crest + rng.range(0, 1.5), rng.range(-0.6, 0.6))
    const to = worldPoint(along * 1.3 + rng.range(-3, 3), SMOKE_CEILING - rng.range(0, 3), rng.range(-3, 3))
    start.set([from.x, from.y, from.z, rng.range(0.6, 1)], i * 4)
    end.set([to.x, to.y, to.z], i * 3)
    params.set([rng(), rng.range(7, 11), rng.range(1.8, 2.6) * GYM_SCALE, rng.range(5, 7) * GYM_SCALE], i * 4)
  }
  return { count, start, end, params }
}

/** Smoke puffs to draw, thinned like the tongues. */
export function smokeCount(coarsePointer: boolean, particleScale: number): number {
  return tongueCount(coarsePointer, particleScale, MAX_SMOKE_PUFFS)
}

/** Where the embers' box sits: over the Flame's centre, its middle this far (blockout metres) up, as high as the spiral. */
const EMBER_MID_Y = 7.5
/** The embers' box height (blockout metres): from the Flame's flare to above its plume's crest. */
const EMBER_SPAN_Y = 10

/** The anchor of the Flame's ember field (`FLAME_EMBERS`), world units. */
export function emberAnchor(): [number, number, number] {
  const c = worldPoint(0, EMBER_MID_Y, 0)
  return [c.x, c.y, c.z]
}

/** Blockout metres (and metres per second) to world units. */
const m = (v: number): number => v * GYM_SCALE

/**
 * The Flame's embers drifting up off it and hot sparks thrown out of it (#520, #599), a `ParticleField` anchored at
 * `emberAnchor()`. Sized, sped and swayed in blockout metres, so it keeps to the Flame at any `GYM_SCALE` (#615): its
 * box covers the fire's footprint (the Flame stands at rot 0, its x along world x).
 */
export const FLAME_EMBERS: ParticleFieldPreset = {
  count: 2200,
  box: [m(2 * (FLAME.halfX + FOOTPRINT_REACH)), m(EMBER_SPAN_Y), m(2 * (FLAME.halfZ + FOOTPRINT_REACH))],
  primary: {
    color: 0xff6a1a,
    opacity: 0.85,
    size: m(0.075),
    maxPixels: 4,
    velocity: [m(0.09), m(0.8), m(0.03)],
    sway: m(0.44),
    flicker: 1,
    additive: true,
  },
  secondary: {
    color: 0xffd27a,
    opacity: 0.9,
    size: m(0.05),
    maxPixels: 3,
    velocity: [m(0.38), m(1.1), m(0.19)],
    sway: m(0.62),
    flicker: 0.8,
    additive: true,
  },
  secondaryShare: 0.4,
}
