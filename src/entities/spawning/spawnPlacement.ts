import type { EnemyType, Formation, FormationOrigin } from '@/types/level'
import type { ArcTable } from '@/track/arcLength'
import type { HeightFunction } from '@/utils/terrainNoise'
import type { Rng } from '@/utils/rng'

/**
 * Where enemies spawn relative to the rider (pure: no three / React).
 *
 * A formation wave is laid out twice. At level load each member gets a slot in
 * its group's local frame (x = right, y = up, z = ahead) plus a seeded jitter, so
 * the same run seed gives the same layout. When the wave activates, every group is
 * anchored on the track ahead of the rider (`formationFrame`) and the slots become
 * world positions, each with an entry start the enemy flies in from.
 */

export interface Vec3 {
  x: number
  y: number
  z: number
}

export type ChoreographedFormation = Exclude<Formation, 'scatter'>

interface FormationSpec {
  /** Largest group; a bigger wave is split into several groups along the track. */
  groupSize: number
  /** Distance between neighbouring slots (the ring's radius). */
  spacing: number
  origin: FormationOrigin
  /** Extra arc distance ahead per later group. */
  groupGap: number
}

export const FORMATIONS: Record<ChoreographedFormation, FormationSpec> = {
  // A flock flying at the rider, leader first, arms trailing up and away.
  v: { groupSize: 9, spacing: 110, origin: { ahead: 900, side: 280, up: 60 }, groupGap: 700 },
  // A rank rising out of the ground beside the track, then marching at the rider.
  line: { groupSize: 7, spacing: 90, origin: { ahead: 600, side: 320, up: 0 }, groupGap: 550 },
  // A school on the water to one side, leaping across the track.
  school: { groupSize: 15, spacing: 55, origin: { ahead: 800, side: 260, up: 0 }, groupGap: 650 },
  // A column swirling up out of the ground (lava) beside the track.
  spiral: { groupSize: 12, spacing: 20, origin: { ahead: 900, side: 260, up: 40 }, groupGap: 800 },
  // A hoop around the track that the rider rides through.
  ring: { groupSize: 10, spacing: 150, origin: { ahead: 700, side: 0, up: 10 }, groupGap: 450 },
}

/** Nothing spawns, or starts its entry, closer than this to the camera. */
export const NEAR_FIELD = 40
/** Air enemies keep at least this much clearance above the drawn terrain. */
export const AIR_CLEARANCE = 60
/** Ground enemies sit this far above the drawn terrain (their own update re-follows it). */
export const GROUND_OFFSET = 5
export const WATER_Y = 0
/** How far ahead and above its slot a V starts ("from the horizon"). */
const V_ENTRY_AHEAD = 700
const V_ENTRY_UP = 200
/** How far below the ground a rising enemy starts. */
const RISE_DEPTH = 90
/** How far back along its heading a fish starts, under water. */
const SCHOOL_ENTRY_BACK = 260
const SCHOOL_ENTRY_DEPTH = 40
/** Turns the spiral unwinds while it rises. */
const SPIRAL_SPIN = Math.PI * 3
/** Look up to this × `ahead` along the track for a point inside the rider's forward cone… */
const ANCHOR_SEARCH = 1.6
const ANCHOR_SEARCH_STEPS = 8
const ANCHOR_CONE_COS = Math.cos((40 * Math.PI) / 180)
/** …that is also at least this × `ahead` away in plan (not just over the top of a loop). */
const ANCHOR_MIN_REACH = 0.5
/** Fish need water: step the anchor ahead until the ground under it is below this. */
const WATER_DEPTH = -5
const WATER_SEARCH_STEP = 150
const WATER_SEARCH_TRIES = 12
const SHORE_PULL_TRIES = 4

export type Surface = 'air' | 'ground' | 'water'

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

/** One member of a formation wave, fixed at level load. */
export interface FormationSlot {
  group: number
  index: number
  groupSize: number
  /** Slot offset in the group's frame: x = right, y = up, z = ahead. */
  local: Vec3
}

/**
 * Split `count` members into groups of at most the formation's group size (sizes
 * differ by at most one) and give each a slot with a little seeded jitter.
 */
export function formationSlots(formation: ChoreographedFormation, count: number, rng: Rng): FormationSlot[] {
  const spec = FORMATIONS[formation]
  const groups = Math.max(1, Math.ceil(count / spec.groupSize))
  const slots: FormationSlot[] = []
  for (let g = 0; g < groups; g++) {
    const size = Math.floor(count / groups) + (g < count % groups ? 1 : 0)
    for (let i = 0; i < size; i++) {
      const local = slotOffset(formation, i, size, spec.spacing)
      const j = spec.spacing * 0.15
      local.x += (rng() - 0.5) * j
      local.y += (rng() - 0.5) * j
      local.z += (rng() - 0.5) * j
      slots.push({ group: g, index: i, groupSize: size, local })
    }
  }
  return slots
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

/** Undisturbed slot `i` of a group of `n` (x = right, y = up, z = ahead). */
export function slotOffset(formation: ChoreographedFormation, i: number, n: number, spacing: number): Vec3 {
  switch (formation) {
    case 'v': {
      // 0 is the leader; then alternate left / right, one step out, up and back each pair.
      // The arms climb so the V reads head-on (a flat V seen from its own height is a line).
      const k = Math.ceil(i / 2)
      const side = i === 0 ? 0 : i % 2 === 1 ? -1 : 1
      return { x: side * k * spacing, y: k * spacing * 0.6, z: k * spacing * 0.4 }
    }
    case 'line':
      return { x: (i - (n - 1) / 2) * spacing, y: 0, z: 0 }
    case 'school': {
      // Sunflower disc: even density, no grid.
      const r = spacing * Math.sqrt(i + 0.5)
      const a = i * GOLDEN_ANGLE
      return { x: r * Math.cos(a), y: 0, z: r * Math.sin(a) }
    }
    case 'spiral': {
      // Two turns, widening and climbing.
      const a = (i / Math.max(1, n)) * Math.PI * 4
      const r = spacing * (3 + i * 0.9)
      return { x: r * Math.cos(a), y: i * spacing * 0.8, z: r * Math.sin(a) }
    }
    case 'ring': {
      // In the plane across the track: x = right, y = up.
      const a = (i / n) * Math.PI * 2
      return { x: spacing * Math.cos(a), y: spacing * Math.sin(a), z: 0 }
    }
  }
}

// ── Track frame ──

/** Index of the arc-table sample nearest to `p` (the rider's position on the track). */
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
  let target = s[index] + dist
  target = ((target % length) + length) % length
  let lo = 0
  let hi = count - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (s[mid] < target) lo = mid
    else hi = mid
  }
  return target - s[lo] < s[hi] - target ? lo : hi
}

/** Unit track tangent at sample `i` (direction of travel). */
export function trackTangent(table: ArcTable, i: number): Vec3 {
  // The last sample repeats the first (t = 1 = t = 0), so wrap over count - 1.
  const n = table.count - 1
  const a = (i - 1 + n) % n
  const b = (i + 1) % n
  return normalize({ x: table.x[b] - table.x[a], y: table.y[b] - table.y[a], z: table.z[b] - table.z[a] })
}

export function trackPoint(table: ArcTable, i: number): Vec3 {
  return { x: table.x[i], y: table.y[i], z: table.z[i] }
}

/** A group's anchor and its horizontal frame. */
export interface FormationFrame {
  /** Track point plus the side / up offsets. */
  origin: Vec3
  /** The track point the anchor was taken from (straight ahead of the rider when the track doubles back). */
  track: Vec3
  /** Horizontal unit direction of travel at the anchor. */
  forward: Vec3
  /** Horizontal unit right of `forward`. */
  right: Vec3
  /** 3D unit tangent at the anchor (a ring stands across it). */
  tangent: Vec3
  /** +1 / -1: which side of the track `side` put the anchor on. */
  sideSign: number
}

/**
 * Anchor for group `group` of a formation, ahead of the rider at sample
 * `riderIndex`: the first track point from `ahead` arc units on (up to
 * ANCHOR_SEARCH × `ahead`) that lies in the rider's forward cone and well away
 * in plan, so the group is in view when it arrives. Later groups sit further on
 * and alternate sides.
 */
export function formationFrame(
  table: ArcTable,
  riderIndex: number,
  formation: ChoreographedFormation,
  group: number,
  origin: FormationOrigin = FORMATIONS[formation].origin,
): FormationFrame {
  const spec = FORMATIONS[formation]
  const ahead = origin.ahead + group * spec.groupGap
  const rider = trackPoint(table, riderIndex)
  const riderTangent = trackTangent(table, riderIndex)
  const riderFwd = horizontal(riderTangent)
  let index = -1
  for (let k = 0; k <= ANCHOR_SEARCH_STEPS && index < 0; k++) {
    const i = indexAhead(table, riderIndex, ahead * (1 + ((ANCHOR_SEARCH - 1) * k) / ANCHOR_SEARCH_STEPS))
    const d = sub(trackPoint(table, i), rider)
    const flat = Math.hypot(d.x, d.z)
    if (flat >= ahead * ANCHOR_MIN_REACH && dot(horizontal(d), riderFwd) >= ANCHOR_CONE_COS) index = i
  }
  // A hairpin or a loop ahead: anchor straight ahead of the rider instead, where the player is looking.
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

// ── Placement ──

/** Where one formation member ends up and how it gets there. */
export interface Placement {
  position: Vec3
  /** Entry start: the enemy flies from here to `position` over `entrySeconds`. */
  from: Vec3
  /** Radians the entry path unwinds around the vertical axis through `from` (spiral). */
  spin: number
  entrySeconds: number
  /** Shared heading (XZ angle, `atan2(dz, dx)`) the group moves on after its entry, so the shape holds. */
  heading?: number
}

export interface PlaceWaveInput {
  table: ArcTable
  /** Sample nearest the rider when the wave activates. */
  riderIndex: number
  /** Camera position (near-field check). */
  camera: Vec3
  formation: ChoreographedFormation
  origin?: FormationOrigin
  type: EnemyType
  groundFn: HeightFunction
  slots: readonly FormationSlot[]
}

/** World placements for every slot of a formation wave, in slot order. */
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
    // A fish whose slot is on the shore closes in toward the (wet) group centre.
    for (let k = 0; k < SHORE_PULL_TRIES && surface === 'water' && groundFn(position.x, position.z) >= WATER_DEPTH; k++) {
      local = { x: local.x * 0.5, y: local.y, z: local.z * 0.5 }
      position = settle(slotWorld(formation, f, local), surface, groundFn)
    }
    const { from, spin } = entryStart(formation, f, position, surface, groundFn)
    return {
      position: outsideNearField(position, camera),
      from: outsideNearField(from, camera),
      spin,
      entrySeconds: entrySeconds(slot.index, slot.groupSize),
      heading: formationHeading(formation, f),
    }
  })
}

/** Step a water formation's anchor ahead until there is water under it (keeps the first frame if none). */
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

/** Slot offset → world, in the group's frame (a ring stands across the 3D tangent). */
export function slotWorld(formation: ChoreographedFormation, f: FormationFrame, local: Vec3): Vec3 {
  if (formation === 'ring') {
    // Ring plane: right × (tangent × right), so the hoop faces the oncoming rider even on a slope.
    const up = normalize(cross(f.right, f.tangent))
    if (up.y < 0) scaleInPlace(up, -1)
    return {
      x: f.origin.x + f.right.x * local.x + up.x * local.y + f.tangent.x * local.z,
      y: f.origin.y + f.right.y * local.x + up.y * local.y + f.tangent.y * local.z,
      z: f.origin.z + f.right.z * local.x + up.z * local.y + f.tangent.z * local.z,
    }
  }
  return {
    x: f.origin.x + f.right.x * local.x + f.forward.x * local.z,
    y: f.origin.y + local.y,
    z: f.origin.z + f.right.z * local.x + f.forward.z * local.z,
  }
}

/** Keep a position on / above the drawn terrain for its surface type. */
export function settle(p: Vec3, surface: Surface, groundFn: HeightFunction): Vec3 {
  const ground = groundFn(p.x, p.z)
  if (surface === 'ground') return { x: p.x, y: ground + GROUND_OFFSET, z: p.z }
  if (surface === 'water') return { x: p.x, y: Math.max(WATER_Y, ground + GROUND_OFFSET), z: p.z }
  return { x: p.x, y: Math.max(p.y, ground + AIR_CLEARANCE), z: p.z }
}

/** Where a member starts its entry: off screen, under ground / water, or at the group's centre. */
export function entryStart(
  formation: ChoreographedFormation,
  f: FormationFrame,
  position: Vec3,
  surface: Surface,
  groundFn: HeightFunction,
): { from: Vec3; spin: number } {
  switch (formation) {
    case 'v':
      return {
        from: {
          x: position.x + f.forward.x * V_ENTRY_AHEAD,
          y: position.y + V_ENTRY_UP,
          z: position.z + f.forward.z * V_ENTRY_AHEAD,
        },
        spin: 0,
      }
    case 'school': {
      const dir = -f.sideSign
      return {
        from: {
          x: position.x - f.right.x * dir * SCHOOL_ENTRY_BACK,
          y: (surface === 'water' ? WATER_Y : position.y) - SCHOOL_ENTRY_DEPTH,
          z: position.z - f.right.z * dir * SCHOOL_ENTRY_BACK,
        },
        spin: 0,
      }
    }
    case 'spiral':
      return {
        from: { x: f.origin.x, y: groundFn(f.origin.x, f.origin.z) - RISE_DEPTH * 0.3, z: f.origin.z },
        spin: SPIRAL_SPIN,
      }
    case 'ring':
      return { from: { x: f.origin.x, y: f.origin.y, z: f.origin.z }, spin: 0 }
    case 'line':
      return { from: { x: position.x, y: groundFn(position.x, position.z) - RISE_DEPTH, z: position.z }, spin: 0 }
  }
}

/** The group's shared heading after its entry, or undefined to keep the enemy's own motion. */
export function formationHeading(formation: ChoreographedFormation, f: FormationFrame): number | undefined {
  switch (formation) {
    case 'v':
    case 'line':
      return Math.atan2(-f.forward.z, -f.forward.x) // at the rider
    case 'school': {
      const dir = -f.sideSign // across the track, from the anchor's side to the other
      return Math.atan2(f.right.z * dir, f.right.x * dir)
    }
    default:
      return undefined
  }
}

/** 1.2–1.8 s, later slots a little later, so a group ripples in. */
export function entrySeconds(index: number, groupSize: number): number {
  return 1.2 + (0.6 * index) / Math.max(1, groupSize - 1)
}

/**
 * Point on an entry path at progress `t` (0–1, eased out). With `spin`, the
 * horizontal offset from `from` unwinds around the vertical axis through `from`.
 */
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

/** `p` pushed straight away from the camera to at least NEAR_FIELD. */
export function outsideNearField(p: Vec3, camera: Vec3, min = NEAR_FIELD): Vec3 {
  const d = sub(p, camera)
  const len = Math.hypot(d.x, d.y, d.z)
  if (len >= min) return p
  if (len < 1e-6) return { x: p.x, y: p.y + min, z: p.z }
  const k = min / len
  return { x: camera.x + d.x * k, y: camera.y + d.y * k, z: camera.z + d.z * k }
}

// ── Vector helpers (plain objects; placement runs once per wave, not per frame) ──

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}
function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }
}
function scaleInPlace(v: Vec3, k: number) {
  v.x *= k
  v.y *= k
  v.z *= k
}
function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z) || 1
  return { x: v.x / len, y: v.y / len, z: v.z / len }
}
function horizontal(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.z)
  return len > 1e-9 ? { x: v.x / len, y: 0, z: v.z / len } : { x: 1, y: 0, z: 0 }
}
