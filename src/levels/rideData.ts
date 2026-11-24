// The one format of generated ride data (`scripts/gen-ride-levels.mjs` writes it, each `<name>Level.ts` reads it back): a
// ride's control points rounded and packed into two flat lists of plain numbers, so the level registry (startup JS) holds a
// ride without the ride elements that build it. Pure: the generator and the ride data tests share the rounding.
import type { RailPoint } from '@/track/curves/SplineCurve'

/** Decimals kept: a control point's position (0 = whole world units) and its up. */
export interface RidePrecision {
  position: number
  up: number
}

/** A ride's control points packed: `xyz` is the first point, the first step, then each step's change from the step before,
 * in units of 10^-position (whole numbers: a straight is a run of zeros, a steady curve small ones, and they gzip well); `ups` is each rolled point's index step from the last
 * rolled point's (a run of rolled points repeats 1) then its up's x, y, z in units of 10^-up: whole numbers, no `0.` to repeat.
 * A ride laid out in a frame turned `yaw` about y (level 2's faces the Pyramid, #864) packs in that frame, where its straights
 * run along the axes and their steps repeat. */
export interface PackedPoints {
  position: number
  up: number
  xyz: number[]
  ups: number[]
  yaw?: number
}

type Xyz = { x: number; y: number; z: number }

/** A world point into the frame turned `yaw` about y, and back (`out`). */
function turn<T extends Xyz>(p: T, yaw: number, out: boolean): T {
  const [c, s] = [Math.cos(yaw), out ? Math.sin(yaw) : -Math.sin(yaw)]
  return { ...p, x: p.x * c + p.z * s, z: -p.x * s + p.z * c }
}

function turnPoint(p: RailPoint, yaw: number, out = false): RailPoint {
  if (!yaw) return p
  const q = turn(p, yaw, out)
  if (p.up) q.up = turn(p.up, yaw, out)
  return q
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

/** The control points as the shipped ride has them (rounded in the frame turned `yaw`, as `packPoints` packs them). */
export function roundPoints(points: readonly RailPoint[], precision: RidePrecision, yaw = 0): RailPoint[] {
  return points.map((world) => {
    const p = turnPoint(world, yaw)
    const q: RailPoint = { x: roundTo(p.x, precision.position), y: roundTo(p.y, precision.position), z: roundTo(p.z, precision.position) }
    if (p.up) q.up = { x: roundTo(p.up.x, precision.up), y: roundTo(p.up.y, precision.up), z: roundTo(p.up.z, precision.up) }
    return turnPoint(q, yaw, true)
  })
}

export function packPoints(world: readonly RailPoint[], precision: RidePrecision, yaw = 0): PackedPoints {
  const points = world.map((p) => turnPoint(p, yaw))
  const scale = 10 ** precision.position
  const xyz: number[] = []
  let last = [0, 0, 0]
  let lastStep = [0, 0, 0]
  points.forEach((p, i) => {
    const units = [p.x, p.y, p.z].map((v) => Math.round(v * scale))
    const step = units.map((u, k) => u - last[k])
    // The first point whole, the first step whole, then each step's change
    step.forEach((d, k) => xyz.push(i < 2 ? d + 0 : d - lastStep[k] + 0))
    last = units
    lastStep = step
  })
  const upScale = 10 ** precision.up
  const ups: number[] = []
  let lastRolled = 0
  points.forEach(({ up }, i) => {
    if (!up) return
    ups.push(i - lastRolled, ...[up.x, up.y, up.z].map((v) => Math.round(v * upScale) + 0))
    lastRolled = i
  })
  const packed = { position: precision.position, up: precision.up, xyz, ups }
  return yaw ? { ...packed, yaw } : packed
}

export function unpackPoints({ position, up, xyz, ups, yaw = 0 }: PackedPoints): RailPoint[] {
  const scale = 10 ** position
  const upScale = 10 ** up
  const points: RailPoint[] = []
  let [x, y, z] = [0, 0, 0]
  let [dx, dy, dz] = [0, 0, 0]
  for (let i = 0; i < xyz.length; i += 3) {
    if (i === 3) [dx, dy, dz] = [0, 0, 0] // The first point was whole; from here the steps add up
    dx += xyz[i]
    dy += xyz[i + 1]
    dz += xyz[i + 2]
    x += dx
    y += dy
    z += dz
    points.push({ x: x / scale + 0, y: y / scale + 0, z: z / scale + 0 })
  }
  let rolled = 0
  for (let i = 0; i < ups.length; i += 4) {
    rolled += ups[i]
    points[rolled].up = { x: ups[i + 1] / upScale + 0, y: ups[i + 2] / upScale + 0, z: ups[i + 3] / upScale + 0 }
  }
  return yaw ? points.map((p) => turnPoint(p, yaw, true)) : points
}
