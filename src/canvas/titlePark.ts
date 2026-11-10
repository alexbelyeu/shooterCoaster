/** The title park's layout (#454), placed once from a fixed seed so every load and the poster still show the same park. */
import * as THREE from 'three'
import { createRng } from '@/utils/rng'
import { PATH_HALF_WIDTH, STALL_DEPTH, STALL_WIDTH, type PathRow, type Placement, type Pole, type Stall, type Wire, wirePoint } from '@/levels/environments/biomes/themePark/parkSpec'
import { CROSSING_LOOP, MAIN_LOOP, type TitleLoop } from './titleCoaster'

export interface Spot {
  x: number
  z: number
}

/** The park's original rides (`TitleScene`): tents on a ring, two carousels, the Ferris wheel's plane at z -75. */
export const TENT_RING = { r: 120, count: 6, radius: 18 }
const TENT_TOP_Y = 36
export const CAROUSELS = [
  { x: -60, z: -40, radius: 25 },
  { x: 20, z: 60, radius: 20 },
]
export const FERRIS_WHEEL = { x: 50, z: -75, radius: 80 }
/** Out past the midway, where no camera shot flies close and the dolly sees it beside the Ferris wheel, not across it. */
export const DROP_TOWER: Spot = { x: 250, z: -90 }
export const SWING_RIDE: Spot = { x: 64, z: -14 }
export const POND = { x: -280, z: 80, rx: 56, rz: 36 }
const FLUME_RADII = { x: 74, z: 52 }

/** The plaza round the fountain, the inner promenade, the promenade inside the loop, the midway boulevard, the outer ring. */
export const RING_PATHS = [15, 92, 177, 205, 330]
export const FOUNTAIN_RADIUS = 9
export const AVENUE_ANGLES = [30, 90, 150, 210, 270, 330].map((d) => (d * Math.PI) / 180)
const AVENUE_FROM = RING_PATHS[0] + PATH_HALF_WIDTH
const AVENUE_TO = 480
/** Ring paths with a midway: stalls on both sides of the boulevard, and the inner side of the outer ring. */
const MIDWAY_ROWS = [
  { ring: 205, side: -1 },
  { ring: 205, side: 1 },
  // The outer row in runs of five, trees in the gaps.
  { ring: 330, side: -1, run: 5 },
]
const LIT_RINGS = [92, 177, 205]

const STALL_SCALE = 0.7
const STALL_GAP = 4
const POLE_HEIGHT = 13
const POLE_SPACING = 20
const BULBS_PER_WIRE = 5
const FLAGS_PER_WIRE = 3
export const PEOPLE = 520
/** Bed rows along both edges of the inner ring and the promenade. */
const PLANTER_RINGS = [92 - PATH_HALF_WIDTH - 3, 92 + PATH_HALF_WIDTH + 3, 177 - PATH_HALF_WIDTH - 3]
const PLANTER_SPACING = 11
/** Hedge segments along the avenues: 20 long, a 4-unit gap between. */
export const HEDGE_LENGTH = 20
const HEDGE_STEP = HEDGE_LENGTH + 4
const HEDGES_FROM = 122
const PLANTER_COLORS = 4

export interface Person extends Placement {
  shirt: number
  skin: number
}

export interface Tree extends Placement {
  scale: number
  tint: number
}

export interface TitleParkLayout {
  path: PathRow[]
  stalls: (Stall & { scale: number })[]
  lightPoles: Pole[]
  lightWires: Wire[]
  bulbs: number[]
  buntingPoles: Pole[]
  buntingWires: Wire[]
  flags: Placement[]
  people: Person[]
  trees: Tree[]
  forest: Tree[]
  hedges: Placement[]
  planters: (Placement & { color: number })[]
}

export const GROUND_Y = -0.5

function loopFootprint(loop: TitleLoop, samples: number): Spot[] {
  const p = new THREE.Vector3()
  const out: Spot[] = []
  for (let i = 0; i < samples; i++) {
    loop.point(i / samples, p)
    out.push({ x: p.x, z: p.z })
  }
  return out
}

const CROSSING_FOOTPRINT = loopFootprint(CROSSING_LOOP, 220)
const TRACK_FOOTPRINT: Spot[] = [...loopFootprint(MAIN_LOOP, 360), ...CROSSING_FOOTPRINT]

function distanceTo(points: readonly Spot[], x: number, z: number): number {
  let best = Infinity
  for (const p of points) {
    const d = (p.x - x) ** 2 + (p.z - z) ** 2
    if (d < best) best = d
  }
  return Math.sqrt(best)
}

export const distanceToTrack = (x: number, z: number) => distanceTo(TRACK_FOOTPRINT, x, z)

/** The hero loop's columns stand clear of the second coaster where it ducks under. */
export const clearOfCrossing = (x: number, z: number) => distanceTo(CROSSING_FOOTPRINT, x, z) > 9

function insideFlume(x: number, z: number, margin: number): boolean {
  return ((x - POND.x) / (FLUME_RADII.x + margin)) ** 2 + ((z - POND.z) / (FLUME_RADII.z + margin)) ** 2 < 1
}

/** True where a ride (or the flume round the lake) stands, `margin` units round it. */
export function onRide(x: number, z: number, margin: number): boolean {
  const r = Math.hypot(x, z)
  if (Math.abs(r - TENT_RING.r) < TENT_RING.radius + margin) {
    const step = (Math.PI * 2) / TENT_RING.count
    const a = Math.atan2(z, x)
    const k = Math.round(a / step) * step
    if (Math.hypot(x - Math.cos(k) * TENT_RING.r, z - Math.sin(k) * TENT_RING.r) < TENT_RING.radius + margin) return true
  }
  for (const c of CAROUSELS) if (Math.hypot(x - c.x, z - c.z) < c.radius + margin) return true
  if (Math.abs(z - FERRIS_WHEEL.z) < 14 + margin && Math.abs(x - FERRIS_WHEEL.x) < FERRIS_WHEEL.radius + margin) return true
  if (Math.hypot(x - DROP_TOWER.x, z - DROP_TOWER.z) < 10 + margin) return true
  if (Math.hypot(x - SWING_RIDE.x, z - SWING_RIDE.z) < 30 + margin) return true
  if (Math.hypot(x, z) < FOUNTAIN_RADIUS + margin) return true
  return insideFlume(x, z, margin)
}

export function distanceToPath(x: number, z: number): number {
  const r = Math.hypot(x, z)
  let best = Infinity
  for (const ring of RING_PATHS) best = Math.min(best, Math.abs(r - ring))
  if (r >= AVENUE_FROM && r <= AVENUE_TO) {
    const a = Math.atan2(z, x)
    for (const av of AVENUE_ANGLES) {
      const da = Math.abs(Math.atan2(Math.sin(a - av), Math.cos(a - av)))
      if (da < Math.PI / 2) best = Math.min(best, r * Math.sin(da))
    }
  }
  return best
}

function ringRows(ring: number, out: PathRow[]) {
  const n = Math.ceil((Math.PI * 2 * ring) / 8)
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2
    const x = Math.cos(a) * ring
    const z = Math.sin(a) * ring
    out.push({ x, y: GROUND_Y + 0.05, z, nx: Math.cos(a), nz: Math.sin(a), open: !insideFlume(x, z, -6) })
  }
}

function avenueRows(angle: number, out: PathRow[]) {
  const n = Math.ceil((AVENUE_TO - AVENUE_FROM) / 8)
  const nx = -Math.sin(angle)
  const nz = Math.cos(angle)
  for (let i = 0; i <= n; i++) {
    const r = AVENUE_FROM + ((AVENUE_TO - AVENUE_FROM) * i) / n
    const x = Math.cos(angle) * r
    const z = Math.sin(angle) * r
    out.push({ x, y: GROUND_Y + 0.05, z, nx, nz, open: !insideFlume(x, z, -6) })
  }
}

/** Every path as one strip of rows for `Midway`'s path mesh; a closed row between paths keeps them apart. */
function buildPaths(): PathRow[] {
  const rows: PathRow[] = []
  const gap = () => rows.push({ ...rows[rows.length - 1], open: false })
  for (const ring of RING_PATHS) {
    ringRows(ring, rows)
    gap()
  }
  for (const a of AVENUE_ANGLES) {
    avenueRows(a, rows)
    gap()
  }
  return rows
}

function nearAvenue(x: number, z: number, clearance: number): boolean {
  const r = Math.hypot(x, z)
  const a = Math.atan2(z, x)
  return AVENUE_ANGLES.some((av) => {
    const da = Math.abs(Math.atan2(Math.sin(a - av), Math.cos(a - av)))
    return da < Math.PI / 2 && r * Math.sin(da) < clearance
  })
}

function buildStalls(rng: ReturnType<typeof createRng>): TitleParkLayout['stalls'] {
  const stalls: TitleParkLayout['stalls'] = []
  const halfW = (STALL_WIDTH * STALL_SCALE) / 2
  const halfD = (STALL_DEPTH * STALL_SCALE) / 2
  for (const { ring, side, run } of MIDWAY_ROWS) {
    const rc = ring + side * (PATH_HALF_WIDTH + 1.5 + halfD)
    const n = Math.floor((Math.PI * 2 * rc) / (STALL_WIDTH * STALL_SCALE + STALL_GAP))
    const offset = rng() * Math.PI * 2
    for (let i = 0; i < n; i++) {
      const a = offset + (i / n) * Math.PI * 2
      const x = Math.cos(a) * rc
      const z = Math.sin(a) * rc
      if ((run && i % (run + 2) >= run) || nearAvenue(x, z, PATH_HALF_WIDTH + halfW + 2)) continue
      if (onRide(x, z, halfW) || distanceToTrack(x, z) < halfW + 8) continue
      // Local +z (the serving front) faces the park centre, where every camera shot stands.
      const yaw = Math.atan2(-Math.cos(a), -Math.sin(a))
      stalls.push({ x, y: GROUND_Y, z, yaw, variant: Math.floor(rng() * 3), color: Math.floor(rng() * 6), scale: STALL_SCALE })
    }
  }
  return stalls
}

function buildLights(layout: Pick<TitleParkLayout, 'lightPoles' | 'lightWires' | 'bulbs' | 'buntingPoles' | 'buntingWires' | 'flags'>) {
  for (let k = 0; k < TENT_RING.count - 1; k++) {
    const top = (i: number): [number, number, number] => {
      const a = (i / TENT_RING.count) * Math.PI * 2
      return [Math.cos(a) * TENT_RING.r, TENT_TOP_Y, Math.sin(a) * TENT_RING.r]
    }
    const w: Wire = { a: top(k), b: top(k + 1), sag: 8 }
    layout.lightWires.push(w)
    for (let j = 1; j <= 6; j++) layout.bulbs.push(...wirePoint(w, j / 7))
  }
  for (const ring of LIT_RINGS) {
    const n = Math.floor((Math.PI * 2 * ring) / POLE_SPACING)
    const edges = [ring - PATH_HALF_WIDTH - 0.8, ring + PATH_HALF_WIDTH + 0.8]
    const poleAt = (i: number, r: number): [number, number, number] | null => {
      const a = (i / n) * Math.PI * 2
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      if (nearAvenue(x, z, PATH_HALF_WIDTH + 3) || onRide(x, z, 2) || distanceToTrack(x, z) < 6) return null
      return [x, GROUND_Y + POLE_HEIGHT, z]
    }
    const tops = edges.map((r) => Array.from({ length: n }, (_, i) => poleAt(i, r)))
    for (let i = 0; i < n; i++) {
      const inner = tops[0][i]
      const outer = tops[1][i]
      for (const top of [inner, outer]) if (top) layout.lightPoles.push({ x: top[0], y: GROUND_Y, z: top[2], height: POLE_HEIGHT })
      if (inner && outer) {
        const w: Wire = { a: inner, b: outer, sag: 2.4 }
        layout.lightWires.push(w)
        for (let k = 1; k <= BULBS_PER_WIRE; k++) layout.bulbs.push(...wirePoint(w, k / (BULBS_PER_WIRE + 1)))
      }
      for (const edge of tops) {
        const a = edge[i]
        const b = edge[(i + 1) % n]
        if (!a || !b) continue
        const w: Wire = { a: [a[0], a[1] - 1.5, a[2]], b: [b[0], b[1] - 1.5, b[2]], sag: 2 }
        layout.buntingWires.push(w)
        const yaw = Math.atan2(-(b[2] - a[2]), b[0] - a[0])
        for (let k = 1; k <= FLAGS_PER_WIRE; k++) {
          const [x, y, z] = wirePoint(w, k / (FLAGS_PER_WIRE + 1))
          layout.flags.push({ x, y, z, yaw })
        }
      }
    }
  }
}

function buildPeople(rng: ReturnType<typeof createRng>): Person[] {
  const people: Person[] = []
  const lengths = [...RING_PATHS.map((r) => Math.PI * 2 * r), ...AVENUE_ANGLES.map(() => AVENUE_TO - AVENUE_FROM)]
  const total = lengths.reduce((a, b) => a + b, 0)
  let guard = 0
  while (people.length < PEOPLE && guard++ < PEOPLE * 20) {
    let pick = rng() * total
    let k = 0
    while (pick > lengths[k]) pick -= lengths[k++]
    const groupOf = rng() < 0.35 ? 2 + Math.floor(rng() * 4) : 1
    const lateral = (rng() * 2 - 1) * (PATH_HALF_WIDTH - 1.2)
    let x: number
    let z: number
    if (k < RING_PATHS.length) {
      const a = (pick / lengths[k]) * Math.PI * 2
      const r = RING_PATHS[k] + lateral
      x = Math.cos(a) * r
      z = Math.sin(a) * r
    } else {
      const av = AVENUE_ANGLES[k - RING_PATHS.length]
      const r = AVENUE_FROM + pick
      x = Math.cos(av) * r - Math.sin(av) * lateral
      z = Math.sin(av) * r + Math.cos(av) * lateral
    }
    for (let g = 0; g < groupOf && people.length < PEOPLE; g++) {
      const px = x + (g ? (rng() - 0.5) * 4 : 0)
      const pz = z + (g ? (rng() - 0.5) * 4 : 0)
      if (onRide(px, pz, 1) || distanceToPath(px, pz) > PATH_HALF_WIDTH) continue
      people.push({ x: px, y: GROUND_Y, z: pz, yaw: rng() * Math.PI * 2, shirt: Math.floor(rng() * 8), skin: Math.floor(rng() * 4) })
    }
  }
  return people
}

interface ClumpSpec {
  clumps: number
  inner: number
  outer: number
  spread: number
  scale: [number, number]
}

/** Park trees among the outer midway, out to the fields. */
const PARK_TREES: ClumpSpec = { clumps: 30, inner: 232, outer: 440, spread: 40, scale: [0.8, 1.5] }
/** Woods round the park, big and low-poly: what fills the ground out to the horizon. */
const FOREST: ClumpSpec = { clumps: 64, inner: 440, outer: 820, spread: 90, scale: [1.6, 2.8] }

function buildTrees(rng: ReturnType<typeof createRng>, stalls: readonly Spot[], spec: ClumpSpec): Tree[] {
  const trees: Tree[] = []
  for (let c = 0; c < spec.clumps; c++) {
    const a = rng() * Math.PI * 2
    const r = Math.sqrt(spec.inner ** 2 + rng() * (spec.outer ** 2 - spec.inner ** 2))
    const cx = Math.cos(a) * r
    const cz = Math.sin(a) * r
    const n = 4 + Math.floor(rng() * 8)
    for (let i = 0; i < n; i++) {
      const x = cx + (rng() - 0.5) * spec.spread
      const z = cz + (rng() - 0.5) * spec.spread
      const tr = Math.hypot(x, z)
      if (tr < spec.inner || distanceToPath(x, z) < PATH_HALF_WIDTH + 5) continue
      if (onRide(x, z, 6) || distanceToTrack(x, z) < 10) continue
      if (stalls.some((s) => Math.hypot(s.x - x, s.z - z) < 14)) continue
      const scale = spec.scale[0] + rng() * (spec.scale[1] - spec.scale[0])
      trees.push({ x, y: GROUND_Y, z, yaw: rng() * Math.PI * 2, scale, tint: rng() })
    }
  }
  return trees
}

function buildHedges(stalls: readonly Spot[]): Placement[] {
  const hedges: Placement[] = []
  for (const av of AVENUE_ANGLES) {
    const nx = -Math.sin(av)
    const nz = Math.cos(av)
    for (let r = HEDGES_FROM; r < AVENUE_TO; r += HEDGE_STEP) {
      for (const side of [-1, 1]) {
        const x = Math.cos(av) * r + nx * side * (PATH_HALF_WIDTH + 2)
        const z = Math.sin(av) * r + nz * side * (PATH_HALF_WIDTH + 2)
        const half = HEDGE_LENGTH / 2
        if (RING_PATHS.some((ring) => Math.abs(r - ring) < half + 16) || onRide(x, z, half) || distanceToTrack(x, z) < half + 4) continue
        if (stalls.some((s) => Math.hypot(s.x - x, s.z - z) < half + 8)) continue
        hedges.push({ x, y: GROUND_Y, z, yaw: -av })
      }
    }
  }
  return hedges
}

/** Low flower beds lining the inner paths, where the grass between the rides and the loop shows most. */
function buildPlanters(rng: ReturnType<typeof createRng>, stalls: readonly Spot[]): TitleParkLayout['planters'] {
  const planters: TitleParkLayout['planters'] = []
  for (const r of PLANTER_RINGS) {
    const n = Math.floor((Math.PI * 2 * r) / PLANTER_SPACING)
    for (let i = 0; i < n; i++) {
      const a = ((i + 0.5) / n) * Math.PI * 2
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      if (nearAvenue(x, z, PATH_HALF_WIDTH + 4) || onRide(x, z, 3) || distanceToTrack(x, z) < 5) continue
      if (stalls.some((s) => Math.hypot(s.x - x, s.z - z) < 12)) continue
      planters.push({ x, y: GROUND_Y, z, yaw: Math.PI / 2 - a, color: Math.floor(rng() * PLANTER_COLORS) })
    }
  }
  return planters
}

/** Ground plane: wide enough that the chase shots never see its edge. */
export const GROUND_SIZE = 2400
export const GRASS_TEXELS = 512

function lattice(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 2147483647)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function valueNoise(x: number, y: number, cell: number, seed: number): number {
  const fx = x / cell
  const fy = y / cell
  const ix = Math.floor(fx)
  const iy = Math.floor(fy)
  const sx = (fx - ix) ** 2 * (3 - 2 * (fx - ix))
  const sy = (fy - iy) ** 2 * (3 - 2 * (fy - iy))
  const top = lattice(ix, iy, seed) + (lattice(ix + 1, iy, seed) - lattice(ix, iy, seed)) * sx
  const bottom = lattice(ix, iy + 1, seed) + (lattice(ix + 1, iy + 1, seed) - lattice(ix, iy + 1, seed)) * sx
  return top + (bottom - top) * sy
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** sRGB RGBA texels of the grass: broad light and dark swathes, drier patches, a fine mottle. */
export function grassTexels(size: number): Uint8Array {
  const out = new Uint8Array(size * size * 4)
  const dark = [0x2a, 0x55, 0x1a]
  const light = [0x48, 0x75, 0x26]
  const dry = [0x76, 0x74, 0x34]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const broad = smooth(0.3, 0.7, valueNoise(x, y, 20, 1))
      const patches = 0.55 * smooth(0.55, 0.8, valueNoise(x, y, 6, 2))
      const fine = 0.9 + 0.2 * valueNoise(x, y, 1.5, 3)
      const o = (y * size + x) * 4
      for (let c = 0; c < 3; c++) {
        const grass = dark[c] + (light[c] - dark[c]) * broad
        out[o + c] = Math.round(Math.min(255, (grass + (dry[c] - grass) * patches) * fine))
      }
      out[o + 3] = 255
    }
  }
  return out
}

export const DROP_TOWER_HEIGHT = 104
const DROP_CAR_LOW = 4
const DROP_CAR_HIGH = 92
/** Bars per drop tower cycle: it rises, hangs at the top, and drops onto the next cycle's first bar line. */
export const DROP_BARS = 4

export function dropCarHeight(phase: number): number {
  const p = phase - Math.floor(phase)
  const span = DROP_CAR_HIGH - DROP_CAR_LOW
  if (p < 0.55) {
    const u = p / 0.55
    return DROP_CAR_LOW + span * u * u * (3 - 2 * u)
  }
  if (p < 0.9) return DROP_CAR_HIGH
  const u = (p - 0.9) / 0.1
  return DROP_CAR_HIGH - span * u * u
}

const FLUME_BASE_Y = 4
const FLUME_LIFT_Y = 22

/** The log flume's channel floor at loop fraction t: a lift hill up, a steep drop back to the lake. */
export function flumePoint(t: number, out: THREE.Vector3): THREE.Vector3 {
  const u = t - Math.floor(t)
  const a = u * Math.PI * 2
  let y = FLUME_BASE_Y
  if (u < 0.32) y += (FLUME_LIFT_Y - FLUME_BASE_Y) * Math.sin((u / 0.32) * Math.PI * 0.5) ** 2
  else if (u < 0.37) y += (FLUME_LIFT_Y - FLUME_BASE_Y) * Math.cos(((u - 0.32) / 0.05) * Math.PI * 0.5) ** 2
  return out.set(POND.x + Math.cos(a) * FLUME_RADII.x, y, POND.z + Math.sin(a) * FLUME_RADII.z)
}

export function buildTitlePark(seed = 454): TitleParkLayout {
  const rng = createRng(seed)
  const stalls = buildStalls(rng)
  const layout: TitleParkLayout = {
    path: buildPaths(),
    stalls,
    lightPoles: [],
    lightWires: [],
    bulbs: [],
    buntingPoles: [],
    buntingWires: [],
    flags: [],
    people: buildPeople(rng),
    trees: buildTrees(rng, stalls, PARK_TREES),
    forest: buildTrees(rng, stalls, FOREST),
    hedges: buildHedges(stalls),
    planters: buildPlanters(rng, stalls),
  }
  buildLights(layout)
  return layout
}
