// The one format of generated ride data (`scripts/gen-ride-levels.mjs` writes it, each `<name>Level.ts` reads it back): a
// ride's control points rounded and packed into two flat lists of plain numbers, so the level registry (startup JS) holds a
// ride without the ride elements that build it. Pure: the generator and the ride data tests share the rounding.
import type { RailPoint } from '@/track/curves/SplineCurve'

/** Decimals kept: a control point's position (0 = whole world units) and its up. */
export interface RidePrecision {
  position: number
  up: number
}

/** A ride's control points packed: `xyz` is the first point then each one's step from the last, in units of 10^-position
 * (whole numbers, so the steps along a straight repeat and gzip well); `ups` is index, x, y, z of each rolled point's up. */
export interface PackedPoints {
  position: number
  xyz: number[]
  ups: number[]
}

/** `v` to `digits` decimals (never -0). */
export function roundTo(v: number, digits: number): number {
  const scale = 10 ** digits
  return Math.round(v * scale) / scale + 0
}

/** Every number in `value` to 6 significant digits, float dust (`-1.11e-16`) to 0: full doubles cost the startup JS ~2 KB gz
 * a ride. For a ride's settings (zones, beats, tunnels) and anything else it ships beside its control points. */
export function roundNumbers<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v: unknown) =>
      typeof v === 'number' ? Number((Math.abs(v) < 1e-9 ? 0 : v).toPrecision(6)) + 0 : v,
    ),
  ) as T
}

/** The control points as the shipped ride has them. */
export function roundPoints(points: readonly RailPoint[], precision: RidePrecision): RailPoint[] {
  return points.map((p) => {
    const q: RailPoint = { x: roundTo(p.x, precision.position), y: roundTo(p.y, precision.position), z: roundTo(p.z, precision.position) }
    if (p.up) q.up = { x: roundTo(p.up.x, precision.up), y: roundTo(p.up.y, precision.up), z: roundTo(p.up.z, precision.up) }
    return q
  })
}

export function packPoints(points: readonly RailPoint[], precision: RidePrecision): PackedPoints {
  const scale = 10 ** precision.position
  const xyz: number[] = []
  let last = [0, 0, 0]
  for (const p of points) {
    const units = [p.x, p.y, p.z].map((v) => Math.round(v * scale))
    units.forEach((u, k) => xyz.push(u - last[k] + 0))
    last = units
  }
  const ups = points.flatMap((p, i) =>
    p.up ? [i, roundTo(p.up.x, precision.up), roundTo(p.up.y, precision.up), roundTo(p.up.z, precision.up)] : [],
  )
  return { position: precision.position, xyz, ups }
}

export function unpackPoints({ position, xyz, ups }: PackedPoints): RailPoint[] {
  const scale = 10 ** position
  const points: RailPoint[] = []
  let [x, y, z] = [0, 0, 0]
  for (let i = 0; i < xyz.length; i += 3) {
    x += xyz[i]
    y += xyz[i + 1]
    z += xyz[i + 2]
    points.push({ x: x / scale + 0, y: y / scale + 0, z: z / scale + 0 })
  }
  for (let i = 0; i < ups.length; i += 4) points[ups[i]].up = { x: ups[i + 1], y: ups[i + 2], z: ups[i + 3] }
  return points
}
