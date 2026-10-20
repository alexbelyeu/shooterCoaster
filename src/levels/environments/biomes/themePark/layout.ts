import { type HeightFunction, TERRAIN_MESH_SEGMENTS, getTerrainMeshSize } from '@/utils/terrainNoise'
import type { ArcTable } from '@/track/arcLength'
import { safeHeight } from '../../shared/safeHeight'
import { type TrackFrame, type TrackIndex, buildTrackIndex, trackFrameAt } from '../../shared/trackClearance'
import {
  ARCH_BOARD_DEPTH,
  ARCH_BOARD_HEIGHT,
  ARCH_BOARD_WIDTH,
  ARCH_HALF_SPAN,
  type Arch,
  FLAG_DROP,
  FLAG_SPACING,
  PALETTE,
  type PathRow,
  type Placement,
  type Pole,
  RIDES,
  SIGN_HEIGHT,
  SIGN_WIDTH,
  SIGN_Y,
  SIGN_Z,
  STALL_DEPTH,
  STALL_WIDTH,
  type Stall,
  type ThemeParkLayout,
  type Wire,
  wirePoint,
} from './parkSpec'

// Everything the Theme Park places, as pure data so layout.test.ts can check it
// against the real level 1 track (rails, towers and the rider's camera).

const STALL_VARIANTS = 3
const LIGHT_POLE_HEIGHT = 30
/** Arch board bottom above the track. */
const ARCH_CLEAR = 30
const ARCH_APPROACH = 250
/** Level 1 eye height (6) + 8. */
const RIDER_CLEARANCE = 14
/** XZ gap between a span across the track and any other pass, whose towers reach the ground. */
const SPAN_TRACK_CLEAR = 14
const SIGN_VARIANT = 2

const STALL_SPACING = 80
const STALL_LATERAL: [number, number] = [50, 108]
/** Stall half-diagonal + tower half-width + margin. */
const STALL_TRACK_CLEAR = 40
const STALL_GAP = 36
const STALL_MAX_STEP = 6
const POLE_TRACK_CLEAR = 14
const WIRE_TRACK_CLEAR = 12
const BULB_SPACING = 6
const MAX_STRING = 170
const BUNTING_COUNT = 10
const BUNTING_HALF_SPAN = 30
const BUNTING_RISE = 32
const BUNTING_SAG = 4
const BUNTING_APPROACH = 80
const PATH_STEP = 8
const PATH_LIFT = 2.5
const TERRAIN_HALF_CELL = (getTerrainMeshSize('themePark') / TERRAIN_MESH_SEGMENTS) * 0.6
const SEED = 1

/** Seeded so the park looks the same every ride. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Circle {
  x: number
  z: number
  r: number
}

function hitsAny(circles: Circle[], x: number, z: number, r: number): boolean {
  for (const c of circles) {
    const rr = c.r + r
    if ((c.x - x) ** 2 + (c.z - z) ** 2 < rr * rr) return true
  }
  return false
}

function wireClear(index: TrackIndex, w: Wire, clear: number): boolean {
  const len = Math.hypot(w.b[0] - w.a[0], w.b[2] - w.a[2])
  const n = Math.max(2, Math.ceil(len / 6))
  for (let k = 0; k <= n; k++) {
    const [x, , z] = wirePoint(w, k / n)
    if (index.near(x, z, clear)) return false
  }
  return true
}

/** So a span is seen ahead and ridden under, not dived through from above. */
function riderStaysBelow(table: ArcTable, d: number, approach: number, y: number): boolean {
  for (let a = d - approach; a <= d + 60; a += 10) {
    if (trackFrameAt(table, a).y + RIDER_CLEARANCE > y) return false
  }
  return true
}

/** End points of a span across the track at `f`, if no other pass comes near it. */
function spanAcross(index: TrackIndex, f: TrackFrame, halfSpan: number, occupied: Circle[]) {
  const sLocal = index.table.s[f.index]
  const elsewhere = (i: number) => Math.abs(index.table.s[i] - sLocal) > 2 * halfSpan + 30
  for (let k = -1; k <= 1.001; k += 0.1) {
    if (index.near(f.x - f.tz * halfSpan * k, f.z + f.tx * halfSpan * k, SPAN_TRACK_CLEAR, elsewhere)) return null
  }
  const ends = [-1, 1].map((k) => ({ x: f.x - f.tz * halfSpan * k, z: f.z + f.tx * halfSpan * k }))
  return ends.some((p) => hitsAny(occupied, p.x, p.z, 6)) ? null : ends
}

function planArch(index: TrackIndex, groundFn: HeightFunction, occupied: Circle[]): Arch | null {
  const { table } = index
  // The first low stretch after the opening drop.
  for (let d = 500; d < 4000; d += 20) {
    const f = trackFrameAt(table, d)
    if (f.y > 70 || (f.tx === 0 && f.tz === 0)) continue
    const boardY = f.y + ARCH_CLEAR
    if (!riderStaysBelow(table, d, ARCH_APPROACH, boardY)) continue
    const feet = spanAcross(index, f, ARCH_HALF_SPAN, occupied)
    if (!feet) continue
    const top = boardY + ARCH_BOARD_HEIGHT
    const groundY = Math.min(...feet.map((p) => groundFn(p.x, p.z)))
    for (const p of feet) occupied.push({ x: p.x, z: p.z, r: 8 })
    return {
      x: f.x,
      y: f.y,
      z: f.z,
      yaw: Math.atan2(f.tx, f.tz),
      boardY,
      groundY,
      postHeight: top - groundY + 2,
    }
  }
  return null
}

/** Closed Catmull-Rom loop through the rides. */
function planPath(index: TrackIndex, heightFn: HeightFunction): PathRow[] {
  const nodes = [...RIDES].sort((a, b) => Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x))
  const n = nodes.length
  const rows: PathRow[] = []
  const { table } = index
  for (let k = 0; k < n; k++) {
    const p0 = nodes[(k - 1 + n) % n]
    const p1 = nodes[k]
    const p2 = nodes[(k + 1) % n]
    const p3 = nodes[(k + 2) % n]
    const steps = Math.ceil(Math.hypot(p2.x - p1.x, p2.z - p1.z) / PATH_STEP)
    for (let j = 0; j < steps; j++) {
      const t = j / steps
      const t2 = t * t
      const t3 = t2 * t
      const cr = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      const dcr = (a: number, b: number, c: number, d: number) =>
        0.5 * ((-a + c) + 2 * (2 * a - 5 * b + 4 * c - d) * t + 3 * (-a + 3 * b - 3 * c + d) * t2)
      const x = cr(p0.x, p1.x, p2.x, p3.x)
      const z = cr(p0.z, p1.z, p2.z, p3.z)
      const dx = dcr(p0.x, p1.x, p2.x, p3.x)
      const dz = dcr(p0.z, p1.z, p2.z, p3.z)
      const len = Math.hypot(dx, dz) || 1
      const y = safeHeight(heightFn, x, z, TERRAIN_HALF_CELL, PATH_LIFT)
      rows.push({
        x,
        y,
        z,
        nx: -dz / len,
        nz: dx / len,
        open: !index.near(x, z, 50, (i) => table.y[i] < y + 30),
      })
    }
  }
  return rows
}

function planStalls(
  index: TrackIndex,
  groundFn: HeightFunction,
  occupied: Circle[],
  path: PathRow[],
  rand: () => number,
): Stall[][] {
  const { table } = index
  const sides: Stall[][] = [[], []]
  const placed: Circle[] = []
  const hw = STALL_WIDTH / 2
  const hd = STALL_DEPTH / 2
  for (let d = STALL_SPACING / 2; d < table.length; d += STALL_SPACING) {
    const f = trackFrameAt(table, d)
    if (f.tx === 0 && f.tz === 0) continue
    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? 1 : -1
      const lateral = STALL_LATERAL[0] + rand() * (STALL_LATERAL[1] - STALL_LATERAL[0])
      const x = f.x - f.tz * lateral * sign
      const z = f.z + f.tx * lateral * sign
      const variant = Math.floor(rand() * STALL_VARIANTS)
      const color = Math.floor(rand() * PALETTE.length)
      if (index.near(x, z, STALL_TRACK_CLEAR)) continue
      if (hitsAny(occupied, x, z, 18) || hitsAny(placed, x, z, STALL_GAP)) continue
      if (path.some((r) => (r.x - x) ** 2 + (r.z - z) ** 2 < 22 * 22)) continue
      // Face the track; reject slopes the skirt can't hide.
      const yaw = Math.atan2(f.x - x, f.z - z)
      const c = Math.cos(yaw)
      const s = Math.sin(yaw)
      let lo = Infinity
      let hi = -Infinity
      for (const [lx, lz] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) {
        const h = groundFn(x + lx * c + lz * s, z - lx * s + lz * c)
        lo = Math.min(lo, h)
        hi = Math.max(hi, h)
      }
      if (hi - lo > STALL_MAX_STEP) continue
      placed.push({ x, z, r: 0 })
      sides[side].push({ x, y: (lo + hi) / 2, z, yaw, variant, color })
    }
  }
  return sides
}

/** A pole in front of each stall, wired to the next stall's pole on the same side. */
function planLights(index: TrackIndex, groundFn: HeightFunction, sides: Stall[][]) {
  const poles: Pole[] = []
  const lightWires: Wire[] = []
  for (const row of sides) {
    let prev: Pole | null = null
    for (const st of row) {
      const off = STALL_DEPTH / 2 + 7
      const x = st.x + Math.sin(st.yaw) * off
      const z = st.z + Math.cos(st.yaw) * off
      if (index.near(x, z, POLE_TRACK_CLEAR)) {
        prev = null
        continue
      }
      const pole = { x, y: groundFn(x, z) - 1, z, height: LIGHT_POLE_HEIGHT + 1 }
      poles.push(pole)
      if (prev) {
        const span = Math.hypot(pole.x - prev.x, pole.z - prev.z)
        const w: Wire = {
          a: [prev.x, prev.y + prev.height, prev.z],
          b: [pole.x, pole.y + pole.height, pole.z],
          sag: Math.min(9, span * 0.07),
        }
        if (span < MAX_STRING && wireClear(index, w, WIRE_TRACK_CLEAR)) lightWires.push(w)
      }
      prev = pole
    }
  }
  return { poles, lightWires }
}

function pushLocal(out: number[], p: Placement, lx: number, ly: number, lz: number) {
  const c = Math.cos(p.yaw)
  const s = Math.sin(p.yaw)
  out.push(p.x + lx * c + lz * s, p.y + ly, p.z - lx * s + lz * c)
}

/** Bulbs along a board's top and bottom edges, on each face in `faceZ`. */
function marquee(out: number[], p: Placement, width: number, bottom: number, height: number, faceZ: number[], step: number) {
  const n = Math.round(width / step)
  for (const z of faceZ) {
    for (let k = 0; k <= n; k++) {
      const x = -width / 2 + (width * k) / n
      pushLocal(out, p, x, bottom, z)
      pushLocal(out, p, x, bottom + height, z)
    }
  }
}

function bulbsAlong(wires: Wire[], stalls: Stall[], arch: Arch | null): number[] {
  const out: number[] = []
  for (const st of stalls) {
    if (st.variant !== SIGN_VARIANT) continue
    marquee(out, st, SIGN_WIDTH, SIGN_Y - SIGN_HEIGHT / 2, SIGN_HEIGHT, [SIGN_Z + 0.9], 2.75)
  }
  if (arch) {
    const archBase = { ...arch, y: arch.boardY }
    const face = ARCH_BOARD_DEPTH / 2 + 0.9
    marquee(out, archBase, ARCH_BOARD_WIDTH, 0, ARCH_BOARD_HEIGHT, [face, -face], 3.5)
  }
  for (const w of wires) {
    const len = Math.hypot(w.b[0] - w.a[0], w.b[2] - w.a[2])
    const n = Math.max(2, Math.round(len / BULB_SPACING))
    for (let k = 1; k < n; k++) out.push(...wirePoint(w, k / n))
  }
  return out
}

/** Ropes of pennants strung across the track, high enough to ride under. */
function planBunting(index: TrackIndex, groundFn: HeightFunction, occupied: Circle[]) {
  const { table } = index
  const poles: Pole[] = []
  const wires: Wire[] = []
  const flags: Placement[] = []
  const step = table.length / BUNTING_COUNT
  for (let k = 0; k < BUNTING_COUNT; k++) {
    // Search outwards from the evenly spaced spot: -40, +40, -80, ...
    for (let tries = 0; tries < 20; tries++) {
      const d = step * (k + 0.5) + (tries % 2 ? 1 : -1) * Math.ceil(tries / 2) * 40
      const f = trackFrameAt(table, d)
      if ((f.tx === 0 && f.tz === 0) || f.y > 130) continue
      const ropeY = f.y + BUNTING_RISE
      if (!riderStaysBelow(table, d, BUNTING_APPROACH, ropeY - BUNTING_SAG - FLAG_DROP)) continue
      const ends = spanAcross(index, f, BUNTING_HALF_SPAN, occupied)
      if (!ends) continue
      const ground = ends.map((p) => groundFn(p.x, p.z) - 1)
      ends.forEach((p, i) => poles.push({ x: p.x, y: ground[i], z: p.z, height: ropeY - ground[i] }))
      const w: Wire = { a: [ends[0].x, ropeY, ends[0].z], b: [ends[1].x, ropeY, ends[1].z], sag: BUNTING_SAG }
      wires.push(w)
      const yaw = Math.atan2(f.tx, f.tz)
      const n = Math.round((BUNTING_HALF_SPAN * 2) / FLAG_SPACING)
      for (let j = 1; j < n; j++) {
        const [x, y, z] = wirePoint(w, j / n)
        flags.push({ x, y, z, yaw })
      }
      break
    }
  }
  return { poles, wires, flags }
}

/** Tents, a boundary hedge and flag poles beyond the midway. */
function planScatter(index: TrackIndex, groundFn: HeightFunction, occupied: Circle[], rand: () => number) {
  const tents: (Placement & { color: number })[] = []
  const flagPoles: (Placement & { color: number })[] = []
  const hedges: Placement[] = []
  const ground = (x: number, z: number) => groundFn(x, z) - 1

  const ring = (count: number, r0: number, r1: number, colorOffset: number) => {
    for (let i = 0; i < count; i++) {
      const theta = ((i + colorOffset * 0.25) / count) * Math.PI * 2
      const r = r0 + rand() * (r1 - r0)
      const x = Math.cos(theta) * r
      const z = Math.sin(theta) * r
      if (index.near(x, z, 45) || hitsAny(occupied, x, z, 28)) continue
      occupied.push({ x, z, r: 26 })
      tents.push({ x, y: ground(x, z), z, yaw: rand() * Math.PI, color: (i + colorOffset) % PALETTE.length })
    }
  }
  ring(14, 1150, 1350, 0)
  ring(10, 1450, 1650, 3)

  for (let i = 0; i < 40; i++) {
    const theta = (i / 40) * Math.PI * 2
    const x = Math.cos(theta) * 1100
    const z = Math.sin(theta) * 1100
    if (index.near(x, z, 25) || hitsAny(occupied, x, z, 10)) continue
    hedges.push({ x, y: ground(x, z), z, yaw: -theta })
  }

  for (let i = 0; i < 30; i++) {
    const r = 100 + rand() * 800
    const theta = rand() * Math.PI * 2
    const x = Math.cos(theta) * r
    const z = Math.sin(theta) * r
    const color = Math.floor(rand() * PALETTE.length)
    if (index.near(x, z, 15) || hitsAny(occupied, x, z, 4)) continue
    flagPoles.push({ x, y: ground(x, z), z, yaw: rand() * Math.PI * 2, color })
  }
  return { tents, hedges, flagPoles }
}

const cache = new WeakMap<ArcTable, ThemeParkLayout>()

/** Planned once per track and shared by Decorations and Features. */
export function getThemeParkLayout(table: ArcTable, heightFn: HeightFunction, groundFn: HeightFunction): ThemeParkLayout {
  let layout = cache.get(table)
  if (!layout) {
    layout = planThemePark(table, heightFn, groundFn)
    cache.set(table, layout)
  }
  return layout
}

export function planThemePark(
  table: ArcTable,
  heightFn: HeightFunction,
  groundFn: HeightFunction,
): ThemeParkLayout {
  const rand = mulberry32(SEED)
  const index = buildTrackIndex(table)
  const occupied: Circle[] = RIDES.map((r) => ({ x: r.x, z: r.z, r: r.radius + 15 }))

  const arch = planArch(index, groundFn, occupied)
  const path = planPath(index, heightFn)
  const stallSides = planStalls(index, groundFn, occupied, path, rand)
  const stalls = stallSides.flat()
  for (const s of stalls) occupied.push({ x: s.x, z: s.z, r: 17 })
  const lights = planLights(index, groundFn, stallSides)
  for (const p of lights.poles) occupied.push({ x: p.x, z: p.z, r: 2 })
  const bunting = planBunting(index, groundFn, occupied)
  const scatter = planScatter(index, groundFn, occupied, rand)

  return {
    arch,
    path,
    stalls,
    lightPoles: lights.poles,
    lightWires: lights.lightWires,
    bulbs: bulbsAlong(lights.lightWires, stalls, arch),
    buntingPoles: bunting.poles,
    buntingWires: bunting.wires,
    flags: bunting.flags,
    ...scatter,
  }
}
