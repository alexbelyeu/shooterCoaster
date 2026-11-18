/**
 * Heat shimmer (#627): where on screen a box of hot air sits, and how hard the composer wavers it. Pure, per
 * frame: `FlameFire` projects the Flame's column with `shimmerRect` and eases `shimmerAmplitude` in and out;
 * `HeatShimmerEffect` distorts the frame inside the rect.
 */

/** Clip-space w of the plane the box is clipped at: anything nearer is at or behind the camera. */
const MIN_W = 0.05
/** The waver at full strength, as a share of the column's height on screen... */
export const SHIMMER_HEIGHT_SHARE = 0.012
/** ...and never more than this (uv), so a column filling the screen still only wavers. */
export const SHIMMER_MAX_UV = 0.006
/** How fast (per second) the shimmer fades in and out as the column comes into and out of view. */
export const SHIMMER_FADE_RATE = 3

/** The box's twelve edges, as corner index pairs (bottom ring, top ring, uprights). */
const EDGES = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7]
/** How far off screen (uv) the rect may reach: a box beside the camera projects wide, and the mask only needs its on-screen part's shape. */
const RECT_REACH = 1
/** Scratch clip-space corners (x, y, w per corner). */
const clip = new Float32Array(24)
/** Scratch screen bounds (uv: x0, y0, x1, y1) and the nearest view distance. */
const bounds = new Float64Array(5)

/** Grows `bounds` to take in the clip-space point (`cx`, `cy`, `w`). */
function take(cx: number, cy: number, w: number): void {
  const u = (cx / w) * 0.5 + 0.5
  const v = (cy / w) * 0.5 + 0.5
  bounds[0] = Math.min(bounds[0], u)
  bounds[1] = Math.min(bounds[1], v)
  bounds[2] = Math.max(bounds[2], u)
  bounds[3] = Math.max(bounds[3], v)
  bounds[4] = Math.min(bounds[4], w)
}

/**
 * Projects the box `corners` (8 × world xyz: the bottom ring, then the top ring above it) through
 * `viewProjection` (a column-major 4×4, three's `Matrix4.elements`) and writes the screen bounds (uv: x0, y0,
 * x1, y1) of its part in front of the camera, then its nearest view distance (a perspective clip w), into `out`.
 * A box the camera is beside is clipped at the camera rather than dropped. False when the box is behind the camera, off screen or too small to see, and then `out`
 * is left as it was.
 */
export function shimmerRect(corners: ArrayLike<number>, viewProjection: ArrayLike<number>, out: Float32Array): boolean {
  const m = viewProjection
  for (let i = 0; i < 8; i++) {
    const x = corners[i * 3]
    const y = corners[i * 3 + 1]
    const z = corners[i * 3 + 2]
    clip[i * 3] = m[0] * x + m[4] * y + m[8] * z + m[12]
    clip[i * 3 + 1] = m[1] * x + m[5] * y + m[9] * z + m[13]
    clip[i * 3 + 2] = m[3] * x + m[7] * y + m[11] * z + m[15]
  }
  bounds[0] = Infinity
  bounds[1] = Infinity
  bounds[2] = -Infinity
  bounds[3] = -Infinity
  bounds[4] = Infinity
  for (let i = 0; i < 8; i++) {
    if (clip[i * 3 + 2] >= MIN_W) take(clip[i * 3], clip[i * 3 + 1], clip[i * 3 + 2])
  }
  // Where an edge crosses the camera's plane: clip coordinates are linear along it
  for (let e = 0; e < EDGES.length; e += 2) {
    const a = EDGES[e] * 3
    const b = EDGES[e + 1] * 3
    const wa = clip[a + 2]
    const wb = clip[b + 2]
    if (wa >= MIN_W === wb >= MIN_W) continue
    const t = (MIN_W - wa) / (wb - wa)
    take(clip[a] + (clip[b] - clip[a]) * t, clip[a + 1] + (clip[b + 1] - clip[a + 1]) * t, MIN_W)
  }
  if (!(bounds[2] > 0 && bounds[3] > 0 && bounds[0] < 1 && bounds[1] < 1)) return false
  const x0 = Math.max(bounds[0], -RECT_REACH)
  const y0 = Math.max(bounds[1], -RECT_REACH)
  const x1 = Math.min(bounds[2], 1 + RECT_REACH)
  const y1 = Math.min(bounds[3], 1 + RECT_REACH)
  if (x1 - x0 < 1e-3 || y1 - y0 < 1e-3) return false
  out[0] = x0
  out[1] = y0
  out[2] = x1
  out[3] = y1
  out[4] = bounds[4]
  return true
}

/** The waver (uv) for a column `rectHeight` (uv) tall, at `strength` 0..1. */
export function shimmerAmplitude(rectHeight: number, strength: number): number {
  return strength * Math.min(rectHeight * SHIMMER_HEIGHT_SHARE, SHIMMER_MAX_UV)
}

/** `strength` eased `dt` seconds towards 1 (`on`) or 0. */
export function easeShimmer(strength: number, on: boolean, dt: number): number {
  const step = SHIMMER_FADE_RATE * dt
  return on ? Math.min(1, strength + step) : Math.max(0, strength - step)
}
