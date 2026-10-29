import type { EnemyType, Formation, FormationOrigin } from '@/types/level'
import type { ArcTable } from '@/track/arcLength'
import type { HeightFunction } from '@/utils/terrainNoise'
import type { Rng } from '@/utils/rng'

/**
 * Formation placement, pure. Slots are seeded at level load (so `spawnDigest` stays
 * deterministic per seed); world positions are only known at activation, once the
 * rider's place on the track is.
 */

export interface Vec3 {
  x: number
  y: number
  z: number
}

export type ChoreographedFormation = Exclude<Formation, 'scatter'>

interface FormationSpec {
  /** A bigger wave is split into several groups further along the track. */
  groupSize: number
  /** Between neighbouring slots; the ring's radius. */
  spacing: number
  origin: FormationOrigin
  /** Extra arc distance ahead per later group. */
  groupGap: number
}

export const FORMATIONS: Record<ChoreographedFormation, FormationSpec> = {
  v: { groupSize: 9, spacing: 110, origin: { ahead: 900, side: 280, up: 60 }, groupGap: 700 },
  line: { groupSize: 7, spacing: 90, origin: { ahead: 600, side: 320, up: 0 }, groupGap: 550 },
  school: { groupSize: 15, spacing: 55, origin: { ahead: 800, side: 260, up: 0 }, groupGap: 650 },
  spiral: { groupSize: 12, spacing: 20, origin: { ahead: 900, side: 260, up: 40 }, groupGap: 800 },
  ring: { groupSize: 10, spacing: 150, origin: { ahead: 700, side: 0, up: 10 }, groupGap: 450 },
}

export const NEAR_FIELD = 40
export const AIR_CLEARANCE = 60
const GROUND_OFFSET = 5
export const WATER_Y = 0
const V_ENTRY_AHEAD = 700
const V_ENTRY_UP = 200
const LINE_ENTRY_DEPTH = 90
const SPIRAL_ENTRY_DEPTH = 30
const SPIRAL_SPIN = Math.PI * 3
const SCHOOL_ENTRY_BACK = 260
const SCHOOL_ENTRY_DEPTH = 40
/** Anchor search: from `ahead` to 1.6 × `ahead` along the track, for a point in a 40° forward cone… */
const ANCHOR_SEARCH = 1.6
const ANCHOR_SEARCH_STEPS = 8
const ANCHOR_CONE_COS = Math.cos((40 * Math.PI) / 180)
/** …at least half of `ahead` away in plan, not just over the top of a loop. */
const ANCHOR_MIN_REACH = 0.5
const WATER_DEPTH = -5
const WATER_SEARCH_STEP = 150
const WATER_SEARCH_TRIES = 12
const SHORE_PULL_TRIES = 4

type Surface = 'air' | 'ground' | 'water'

export function enemySurface(type: EnemyType): Surface {
  switch (type) {
    case 'scorpion':
    case 'snowman':
    case 'snowmanScout':
    case 'snowmanBrute':
    case 'lavaGolem':
    case 'fireImp':
      return 'ground'
    case 'shark':
    case 'jellyfish':
    case 'flyingFish':
      return 'water'
    default:
      return 'air'
  }
}

export interface FormationSlot {
  group: number
  index: number
  groupSize: number
  /** x = right, y = up, z = ahead, in the group's frame. */
  local: Vec3
}

/** `count` members in groups no bigger than the spec's (sizes differ by at most one), each slot jittered by `rng`. */
export function formationSlots(formation: ChoreographedFormation, count: number, rng: Rng): FormationSlot[] {
  const spec = FORMATIONS[formation]
  const groups = Math.max(1, Math.ceil(count / spec.groupSize))
  const jitter = spec.spacing * 0.15
  const slots: FormationSlot[] = []
  for (let g = 0; g < groups; g++) {
    const size = Math.floor(count / groups) + (g < count % groups ? 1 : 0)
    for (let i = 0; i < size; i++) {
      const local = slotOffset(formation, i, size, spec.spacing)
      local.x += (rng() - 0.5) * jitter
      local.y += (rng() - 0.5) * jitter
      local.z += (rng() - 0.5) * jitter
      slots.push({ group: g, index: i, groupSize: size, local })
    }
  }
  return slots
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

export function slotOffset(formation: ChoreographedFormation, i: number, n: number, spacing: number): Vec3 {
  switch (formation) {
    case 'v': {
      // The arms climb as well as trail: a flat V seen from its own height reads as a line.
      const k = Math.ceil(i / 2)
      const side = i === 0 ? 0 : i % 2 === 1 ? -1 : 1
      return { x: side * k * spacing, y: k * spacing * 0.6, z: k * spacing * 0.4 }
    }
    case 'line':
      return { x: (i - (n - 1) / 2) * spacing, y: 0, z: 0 }
    case 'school': {
      const r = spacing * Math.sqrt(i + 0.5)
      const a = i * GOLDEN_ANGLE
      return { x: r * Math.cos(a), y: 0, z: r * Math.sin(a) }
    }
    case 'spiral': {
      const a = (i / Math.max(1, n)) * Math.PI * 4
      const r = spacing * (3 + i * 0.9)
      return { x: r * Math.cos(a), y: i * spacing * 0.8, z: r * Math.sin(a) }
    }
    case 'ring': {
      // y here is across the track (see slotWorld), not world up.
      const a = (i / n) * Math.PI * 2
      return { x: spacing * Math.cos(a), y: spacing * Math.sin(a), z: 0 }
    }
  }
}

export function nearestTrackIndex(table: ArcTable, p: Vec3): number {
  let best = 0
  let bestSq = Infinity
  for (let i = 0; i < table.count; i++) {
    const dx = table.x[i] - p.x
    const dy = table.y[i] - p.y
    const dz = table.z[i] - p.z
    const d = dx * dx + dy * dy + dz * dz
    if (d < bestSq) {
      bestSq = d
      best = i
    }
  }
  return best
}

/** Sample index `dist` arc units past `index`, wrapping around the closed track. */
export function indexAhead(table: ArcTable, index: number, dist: number): number {
  const { s, length, count } = table
  const target = (((s[index] + dist) % length) + length) % length
  let lo = 0
  let hi = count - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (s[mid] < target) lo = mid
    else hi = mid
  }
  return target - s[lo] < s[hi] - target ? lo : hi
}

export function trackTangent(table: ArcTable, i: number): Vec3 {
  // The last sample repeats the first (t = 1 is t = 0).
  const n = table.count - 1
  const a = (i - 1 + n) % n
  const b = (i + 1) % n
  return normalize({ x: table.x[b] - table.x[a], y: table.y[b] - table.y[a], z: table.z[b] - table.z[a] })
}

export function trackPoint(table: ArcTable, i: number): Vec3 {
  return { x: table.x[i], y: table.y[i], z: table.z[i] }
}

export interface FormationFrame {
  /** `track` plus the side / up offsets. */
  origin: Vec3
  track: Vec3
  /** Horizontal unit vectors. */
  forward: Vec3
  right: Vec3
  tangent: Vec3
  sideSign: number
}

/**
 * Anchor for one group, ahead of the rider at `riderIndex` and in view when it
 * arrives; later groups sit further on and alternate sides.
 */
export function formationFrame(
  table: ArcTable,
  riderIndex: number,
  formation: ChoreographedFormation,
  group: number,
  origin: FormationOrigin = FORMATIONS[formation].origin,
): FormationFrame {
  const ahead = origin.ahead + group * FORMATIONS[formation].groupGap
  const rider = trackPoint(table, riderIndex)
  const riderTangent = trackTangent(table, riderIndex)
  const riderFwd = horizontal(riderTangent)
  let index = -1
  for (let k = 0; k <= ANCHOR_SEARCH_STEPS && index < 0; k++) {
    const i = indexAhead(table, riderIndex, ahead * (1 + ((ANCHOR_SEARCH - 1) * k) / ANCHOR_SEARCH_STEPS))
    const d = sub(trackPoint(table, i), rider)
    if (Math.hypot(d.x, d.z) >= ahead * ANCHOR_MIN_REACH && dot(horizontal(d), riderFwd) >= ANCHOR_CONE_COS) index = i
  }
  // The track doubles back (hairpin, loop): anchor straight ahead of the rider, where the player looks.
  const track = index >= 0
    ? trackPoint(table, index)
    : { x: rider.x + riderFwd.x * ahead, y: rider.y, z: rider.z + riderFwd.z * ahead }
  const tangent = index >= 0 ? trackTangent(table, index) : riderTangent
  const forward = horizontal(tangent)
  const right = { x: -forward.z, y: 0, z: forward.x }
  const side = origin.side * (group % 2 === 0 ? 1 : -1)
  return {
    origin: { x: track.x + right.x * side, y: track.y + origin.up, z: track.z + right.z * side },
    track,
    forward,
    right,
    tangent,
    sideSign: side < 0 ? -1 : 1,
  }
}

export interface Placement {
  position: Vec3
  /** Entry start: the enemy flies from here to `position` over `entrySeconds`. */
  from: Vec3
  /** Radians the entry unwinds around the vertical axis through `from`. */
  spin: number
  entrySeconds: number
  /** XZ angle (`atan2(dz, dx)`) the whole group moves on afterwards, so its shape holds. */
  heading?: number
}

export interface PlaceWaveInput {
  table: ArcTable
  riderIndex: number
  camera: Vec3
  formation: ChoreographedFormation
  origin?: FormationOrigin
  type: EnemyType
  groundFn: HeightFunction
  slots: readonly FormationSlot[]
}

/** World placements for a formation wave's slots, in slot order. */
export function placeFormationWave(input: PlaceWaveInput): Placement[] {
  const { table, riderIndex, camera, formation, type, groundFn, slots } = input
  const surface = enemySurface(type)
  const frames = new Map<number, FormationFrame>()
  const frameFor = (group: number) => {
    let f = frames.get(group)
    if (!f) {
      f = formationFrame(table, riderIndex, formation, group, input.origin)
      if (surface === 'water') f = findWater(table, riderIndex, formation, group, input.origin, groundFn, f)
      frames.set(group, f)
    }
    return f
  }

  return slots.map((slot) => {
    const f = frameFor(slot.group)
    let local = slot.local
    let position = settle(slotWorld(formation, f, local), surface, groundFn)
    // A fish whose slot is on the shore closes in toward the wet group centre.
    for (let k = 0; k < SHORE_PULL_TRIES && surface === 'water' && groundFn(position.x, position.z) >= WATER_DEPTH; k++) {
      local = { x: local.x * 0.5, y: local.y, z: local.z * 0.5 }
      position = settle(slotWorld(formation, f, local), surface, groundFn)
    }
    const { from, spin } = entryStart(formation, f, position, groundFn)
    return {
      position: outsideNearField(position, camera),
      from: outsideNearField(from, camera),
      spin,
      entrySeconds: 1.2 + (0.6 * slot.index) / Math.max(1, slot.groupSize - 1),
      heading: formationHeading(formation, f),
    }
  })
}

/** Move a water group's anchor further ahead, or across the track, until there is water under it. */
function findWater(
  table: ArcTable,
  riderIndex: number,
  formation: ChoreographedFormation,
  group: number,
  origin: FormationOrigin | undefined,
  groundFn: HeightFunction,
  first: FormationFrame,
): FormationFrame {
  const base = origin ?? FORMATIONS[formation].origin
  for (let k = 0; k < WATER_SEARCH_TRIES; k++) {
    for (const side of [base.side, -base.side]) {
      const f = k === 0 && side === base.side
        ? first
        : formationFrame(table, riderIndex, formation, group, { ...base, side, ahead: base.ahead + k * WATER_SEARCH_STEP })
      if (groundFn(f.origin.x, f.origin.z) < WATER_DEPTH) return f
    }
  }
  return first
}

function slotWorld(formation: ChoreographedFormation, f: FormationFrame, local: Vec3): Vec3 {
  if (formation === 'ring') {
    // The hoop stands across the 3D tangent, so it faces the oncoming rider on a slope too.
    const up = normalize(cross(f.right, f.tangent))
    const s = up.y < 0 ? -1 : 1
    return {
      x: f.origin.x + f.right.x * local.x + s * up.x * local.y + f.tangent.x * local.z,
      y: f.origin.y + f.right.y * local.x + s * up.y * local.y + f.tangent.y * local.z,
      z: f.origin.z + f.right.z * local.x + s * up.z * local.y + f.tangent.z * local.z,
    }
  }
  return {
    x: f.origin.x + f.right.x * local.x + f.forward.x * local.z,
    y: f.origin.y + local.y,
    z: f.origin.z + f.right.z * local.x + f.forward.z * local.z,
  }
}

function settle(p: Vec3, surface: Surface, groundFn: HeightFunction): Vec3 {
  const ground = groundFn(p.x, p.z)
  if (surface === 'ground') return { x: p.x, y: ground + GROUND_OFFSET, z: p.z }
  if (surface === 'water') return { x: p.x, y: Math.max(WATER_Y, ground + GROUND_OFFSET), z: p.z }
  return { x: p.x, y: Math.max(p.y, ground + AIR_CLEARANCE), z: p.z }
}

function entryStart(
  formation: ChoreographedFormation,
  f: FormationFrame,
  position: Vec3,
  groundFn: HeightFunction,
): { from: Vec3; spin: number } {
  switch (formation) {
    case 'v': // from the horizon
      return {
        from: {
          x: position.x + f.forward.x * V_ENTRY_AHEAD,
          y: position.y + V_ENTRY_UP,
          z: position.z + f.forward.z * V_ENTRY_AHEAD,
        },
        spin: 0,
      }
    case 'school': // from under the water, behind its heading
      return {
        from: {
          x: position.x + f.right.x * f.sideSign * SCHOOL_ENTRY_BACK,
          y: WATER_Y - SCHOOL_ENTRY_DEPTH,
          z: position.z + f.right.z * f.sideSign * SCHOOL_ENTRY_BACK,
        },
        spin: 0,
      }
    case 'spiral': // out of the ground under the column
      return {
        from: { x: f.origin.x, y: groundFn(f.origin.x, f.origin.z) - SPIRAL_ENTRY_DEPTH, z: f.origin.z },
        spin: SPIRAL_SPIN,
      }
    case 'ring': // bursting out from the hoop's centre
      return { from: { ...f.origin }, spin: 0 }
    case 'line': // up out of the ground
      return { from: { x: position.x, y: groundFn(position.x, position.z) - LINE_ENTRY_DEPTH, z: position.z }, spin: 0 }
  }
}

function formationHeading(formation: ChoreographedFormation, f: FormationFrame): number | undefined {
  switch (formation) {
    case 'v':
    case 'line':
      return Math.atan2(-f.forward.z, -f.forward.x) // at the rider
    case 'school':
      return Math.atan2(f.right.z * -f.sideSign, f.right.x * -f.sideSign) // across the track
    default:
      return undefined
  }
}

/** Scattered over the map, ground enemies were rarely in view (#179); `ahead` spans ~8–25 s at Antarctica's slowest. */
export const TRACKSIDE = { aheadMin: 700, aheadMax: 2200, sideMin: 60, sideMax: 400 }

export function placedBesideTrack(type: EnemyType): boolean {
  switch (type) {
    case 'snowman':
    case 'snowmanScout':
    case 'snowmanBrute':
    case 'lavaGolem':
    case 'fireImp':
      return true
    default:
      return false
  }
}

export interface TracksideSlot {
  /** Arc distance past the rider. */
  ahead: number
  /** Signed horizontal offset to the right of the track. */
  side: number
}

export function tracksideSlots(count: number, rng: Rng): TracksideSlot[] {
  const { aheadMin, aheadMax, sideMin, sideMax } = TRACKSIDE
  return Array.from({ length: count }, () => {
    const ahead = rng.range(aheadMin, aheadMax)
    const side = rng.range(sideMin, sideMax) * (rng() < 0.5 ? -1 : 1)
    return { ahead, side }
  })
}

export interface PlaceTracksideInput {
  table: ArcTable
  riderIndex: number
  camera: Vec3
  groundFn: HeightFunction
  slots: readonly TracksideSlot[]
}

export function placeTracksideWave({ table, riderIndex, camera, groundFn, slots }: PlaceTracksideInput): Vec3[] {
  return slots.map((slot) => {
    const i = indexAhead(table, riderIndex, slot.ahead)
    const forward = horizontal(trackTangent(table, i))
    const x = table.x[i] - forward.z * slot.side
    const z = table.z[i] + forward.x * slot.side
    return outsideNearField(settle({ x, y: 0, z }, 'ground', groundFn), camera)
  })
}

/** Point on an entry path at `t` (0–1, eased out); `spin` unwinds the horizontal offset around `from`. */
export function entryPoint(out: Vec3, from: Vec3, to: Vec3, t: number, spin: number): Vec3 {
  const u = Math.min(Math.max(t, 0), 1)
  const e = 1 - (1 - u) ** 3
  let dx = (to.x - from.x) * e
  let dz = (to.z - from.z) * e
  if (spin !== 0) {
    const a = spin * (1 - e)
    const c = Math.cos(a)
    const s = Math.sin(a)
    const rx = dx * c - dz * s
    dz = dx * s + dz * c
    dx = rx
  }
  out.x = from.x + dx
  out.y = from.y + (to.y - from.y) * e
  out.z = from.z + dz
  return out
}

/** `p` pushed straight away from the camera to at least `min`. */
export function outsideNearField(p: Vec3, camera: Vec3, min = NEAR_FIELD): Vec3 {
  const d = sub(p, camera)
  const len = Math.hypot(d.x, d.y, d.z)
  if (len >= min) return p
  if (len < 1e-6) return { x: p.x, y: p.y + min, z: p.z }
  const k = min / len
  return { x: camera.x + d.x * k, y: camera.y + d.y * k, z: camera.z + d.z * k }
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}
function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }
}
function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z) || 1
  return { x: v.x / len, y: v.y / len, z: v.z / len }
}
function horizontal(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.z)
  return len > 1e-9 ? { x: v.x / len, y: 0, z: v.z / len } : { x: 1, y: 0, z: 0 }
}
