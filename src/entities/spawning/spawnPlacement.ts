import type { EnemyType, Formation, FormationOrigin } from '@/types/level'
import type { ArcTable } from '@/track/arcLength'
import type { HeightFunction } from '@/utils/terrainNoise'
import type { Rng } from '@/utils/rng'
import { maxReadableDistance } from '../enemies/enemyReadability'
import { ENEMY_PLACEMENT, WATER_DEPTH, WATER_Y, type Surface } from './enemyPlacement'
import { LOOK_AHEAD_UNITS, lookAheadDirection } from '@/track/cameraRig'
import { MIN_HORIZONTAL_FOV } from '@/track/cameraFov'

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
const V_ENTRY_AHEAD = 700
const V_ENTRY_UP = 200
const LINE_ENTRY_DEPTH = 90
const SPIRAL_ENTRY_DEPTH = 30
const SPIRAL_SPIN = Math.PI * 3
const SCHOOL_ENTRY_BACK = 260
const SCHOOL_ENTRY_DEPTH = 40
/** Anchor search: from `ahead` to 1.6 × `ahead` along the track, for a group centre in view (`inView`)… */
const ANCHOR_SEARCH = 1.6
const ANCHOR_SEARCH_STEPS = 8
/** …at least half of `ahead` away in plan, not just over the top of a loop. */
const ANCHOR_MIN_REACH = 0.5
/** A trackside slot's approach cone around the rig's look direction (`inViewOnApproach`). */
const APPROACH_CONE_COS = Math.cos((40 * Math.PI) / 180)
const WATER_SEARCH_STEP = 150
const WATER_SEARCH_TRIES = 12
const SHORE_PULL_TRIES = 4

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
  /** The group's centre is in view where it lands (false: the straight-ahead fallback). */
  seen: boolean
}

/** What the ride does after a wave activates, from the level's ride profile (`track/ridePhysics.ts`). */
export interface RideAhead {
  /** Arc distance the rider covers while the wave flies in (`ENTRY_SECONDS` + `ENTRY_STAGGER`). */
  entry: number
  /** Arc distance the rider covers over the wave's window: until the next wave, the boss or the end of the run. */
  window: number
  /** The level's structure scale: the rig looks `LOOK_AHEAD_UNITS` × this ahead. */
  trackScale: number
}

/** A formation member flies in over `ENTRY_SECONDS`, the last of its group `ENTRY_STAGGER` later. */
export const ENTRY_SECONDS = 1.2
export const ENTRY_STAGGER = 0.6

/** A group's centre lands this far inside the narrowest screen's half fov (`MIN_HORIZONTAL_FOV`), so the group's width fits. */
const VIEW_HALF_ANGLE_COS = Math.cos((MIN_HORIZONTAL_FOV * 0.4 * Math.PI) / 180)
/** No group or trackside slot leads the rider by more than this share of a lap. */
const MAX_LEAD_SHARE = 0.75

/** Where the rig looks from track sample `index`: its eye and unit look direction (cameraRig's look-ahead blend, unsmoothed). */
export interface TrackView {
  index: number
  eye: Vec3
  dir: Vec3
}

export function trackView(table: ArcTable, index: number, trackScale: number): TrackView {
  const eye = trackPoint(table, index)
  const toAhead = normalize(sub(trackPoint(table, indexAhead(table, index, LOOK_AHEAD_UNITS * trackScale)), eye))
  return { index, eye, dir: lookAheadDirection(trackTangent(table, index), toAhead, { x: 0, y: 0, z: 0 }) }
}

export function inView(view: TrackView, p: Vec3, reach: number): boolean {
  const d = sub(p, view.eye)
  const plan = Math.hypot(d.x, d.z)
  if (plan < 1e-6 || Math.hypot(d.x, d.y, d.z) > reach) return false
  const f = horizontal(view.dir)
  return (d.x * f.x + d.z * f.z) / plan >= VIEW_HALF_ANGLE_COS
}

/** Arc distance between neighbouring groups: the wave's window shared out, so the rider meets one every `window / groups`. */
export function groupStep(table: ArcTable, formation: ChoreographedFormation, groups: number, ride: RideAhead): number {
  const { groupGap } = FORMATIONS[formation]
  return Math.max(groupGap, Math.min(ride.window, MAX_LEAD_SHARE * table.length) / Math.max(1, groups))
}

/** Anchor for one group: `centre` (its mean slot offset) in view from where the rider is once the group has flown in; sides alternate per group unless only the other is in view. */
export function formationFrame(
  table: ArcTable,
  riderIndex: number,
  formation: ChoreographedFormation,
  group: number,
  ride: RideAhead,
  reach: number,
  step: number = FORMATIONS[formation].groupGap,
  origin: FormationOrigin = FORMATIONS[formation].origin,
  centre: Vec3 = { x: 0, y: 0, z: 0 },
): FormationFrame {
  const view = trackView(table, indexAhead(table, riderIndex, group * step + ride.entry), ride.trackScale)
  const { ahead, up } = origin
  const preferred = origin.side * (group % 2 === 0 ? 1 : -1)
  const sides = preferred === 0 ? [0] : [preferred, -preferred]
  for (let k = 0; k <= ANCHOR_SEARCH_STEPS; k++) {
    const i = indexAhead(table, view.index, ahead * (1 + ((ANCHOR_SEARCH - 1) * k) / ANCHOR_SEARCH_STEPS))
    const track = trackPoint(table, i)
    const d = sub(track, view.eye)
    if (Math.hypot(d.x, d.z) < ahead * ANCHOR_MIN_REACH) continue // over the top of a loop
    for (const side of sides) {
      const f = frameAt(track, trackTangent(table, i), side, up, true)
      if (inView(view, slotWorld(formation, f, centre), reach)) return f
    }
  }
  // The track doubles back (hairpin, loop): anchor straight ahead of where the rider looks.
  const look = horizontal(view.dir)
  const track = { x: view.eye.x + look.x * ahead, y: view.eye.y, z: view.eye.z + look.z * ahead }
  return frameAt(track, look, preferred, up, false)
}

function frameAt(track: Vec3, tangent: Vec3, side: number, up: number, seen: boolean): FormationFrame {
  const forward = horizontal(tangent)
  const right = { x: -forward.z, y: 0, z: forward.x }
  return {
    origin: { x: track.x + right.x * side, y: track.y + up, z: track.z + right.z * side },
    track,
    forward,
    right,
    tangent,
    sideSign: side < 0 ? -1 : 1,
    seen,
  }
}

export interface Placement {
  position: Vec3
  /** Entry start: the enemy flies from here to `position` over `entrySeconds`. */
  from: Vec3
  /** Radians the entry unwinds around the vertical axis through `from`. */
  spin: number
  entrySeconds: number
  motion?: FormationMotion
}

/**
 * How a member moves once it has entered: the whole group on one XZ heading
 * (`atan2(dz, dx)`) so its shape holds, or bobbing at its slot. Absent: the enemy's own wander.
 */
export type FormationMotion = { kind: 'march'; heading: number } | { kind: 'hold' }

/** The group heading of a marching member, else undefined. */
export function marchHeading(motion: FormationMotion | undefined): number | undefined {
  return motion?.kind === 'march' ? motion.heading : undefined
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
  ride: RideAhead
}

/** World placements for a formation wave's slots, in slot order. */
export function placeFormationWave(input: PlaceWaveInput): Placement[] {
  const { table, riderIndex, camera, formation, type, groundFn, slots, ride } = input
  const surface = ENEMY_PLACEMENT[type].surface
  const reach = maxReadableDistance(type)
  const groups = slots.reduce((n, s) => Math.max(n, s.group + 1), 0)
  const step = groupStep(table, formation, groups, ride)
  const frames = new Map<number, FormationFrame>()
  const frameFor = (group: number) => {
    let f = frames.get(group)
    if (!f) {
      const members = slots.filter((s) => s.group === group)
      const centre = members.reduce(
        (c, s) => ({ x: c.x + s.local.x / members.length, y: c.y + s.local.y / members.length, z: c.z + s.local.z / members.length }),
        { x: 0, y: 0, z: 0 },
      )
      const at = (origin?: FormationOrigin) => formationFrame(table, riderIndex, formation, group, ride, reach, step, origin, centre)
      f = at(input.origin)
      if (surface === 'water') f = findWater(at, input.origin ?? FORMATIONS[formation].origin, groundFn, f)
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
      entrySeconds: ENTRY_SECONDS + (ENTRY_STAGGER * slot.index) / Math.max(1, slot.groupSize - 1),
      motion: formationMotion(formation, f),
    }
  })
}

/** Move a water group's anchor further ahead, or across the track: the first with water under it in view, else the first with water under it. */
function findWater(
  frameFor: (origin: FormationOrigin) => FormationFrame,
  base: FormationOrigin,
  groundFn: HeightFunction,
  first: FormationFrame,
): FormationFrame {
  let wet: FormationFrame | null = null
  for (let k = 0; k < WATER_SEARCH_TRIES; k++) {
    for (const side of [base.side, -base.side]) {
      const f = k === 0 && side === base.side
        ? first
        : frameFor({ ...base, side, ahead: base.ahead + k * WATER_SEARCH_STEP })
      if (groundFn(f.origin.x, f.origin.z) >= WATER_DEPTH) continue
      if (f.seen) return f
      wet ??= f
    }
  }
  return wet ?? first
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

function formationMotion(formation: ChoreographedFormation, f: FormationFrame): FormationMotion | undefined {
  switch (formation) {
    case 'v':
    case 'line':
      return { kind: 'march', heading: Math.atan2(-f.forward.z, -f.forward.x) } // at the rider
    case 'school':
      return { kind: 'march', heading: Math.atan2(f.right.z * -f.sideSign, f.right.x * -f.sideSign) } // across the track
    case 'ring':
      return { kind: 'hold' } // drifting off would break the hoop before the rider gets there
    case 'spiral':
      return undefined
  }
}

export interface TracksideBand {
  aheadMin: number
  aheadMax: number
  sideMin: number
  sideMax: number
  /** The first `share` of a wave's slots lands no further than `max` ahead, so the wave is in view as it arrives. */
  near?: { share: number; max: number }
  /** Ground: the band is stretched over the arc the rider covers in the wave's window (`placeTracksideWave`). */
  spread?: boolean
}

/**
 * Ground: spread evenly from 700 ahead over the wave's window, at least to 2200; water: ~1–14 s of
 * Ocean's ~250 units/s ride, about its gap between waves (#316).
 */
export const TRACKSIDE: Record<'ground' | 'water', TracksideBand> = {
  ground: { aheadMin: 700, aheadMax: 2200, sideMin: 60, sideMax: 400, spread: true },
  water: { aheadMin: 300, aheadMax: 3600, sideMin: 60, sideMax: 400, near: { share: 0.5, max: 1500 } },
}

export const tracksideBand = (surface: Surface): TracksideBand => TRACKSIDE[surface === 'water' ? 'water' : 'ground']

/**
 * A slot must be in view on its approach: inside the rig's look cone and readable from the rider
 * `VIEW_LEAD` before it (or at activation, if nearer) and still `VIEW_HOLD` further on.
 */
const VIEW_LEAD = 1100
const VIEW_HOLD = 400

export interface TracksideSlot {
  /** Arc distance past the rider, in the band; a spread band stretches it over the wave's window. */
  ahead: number
  /** Signed horizontal offset to the right of the track. */
  side: number
}

/** A spread band's slots are one per even step of it (jittered within the step), so the stretch has no empty run. */
export function tracksideSlots(count: number, surface: Surface, rng: Rng): TracksideSlot[] {
  const { aheadMin, aheadMax, sideMin, sideMax, near, spread } = tracksideBand(surface)
  const nearCount = near ? Math.ceil(count * near.share) : 0
  return Array.from({ length: count }, (_, i) => {
    const ahead = spread
      ? aheadMin + ((i + rng()) / count) * (aheadMax - aheadMin)
      : rng.range(aheadMin, i < nearCount ? near!.max : aheadMax)
    const side = rng.range(sideMin, sideMax) * (rng() < 0.5 ? -1 : 1)
    return { ahead, side }
  })
}

/** Arc distance past the rider of a slot: a spread band stretched over the window, never past `MAX_LEAD_SHARE` of a lap. */
export function tracksideAhead(table: ArcTable, surface: Surface, slot: TracksideSlot, ride: RideAhead): number {
  const { aheadMin, aheadMax, spread } = tracksideBand(surface)
  if (!spread) return slot.ahead
  const span = Math.max(aheadMax - aheadMin, Math.min(ride.window, MAX_LEAD_SHARE * table.length - aheadMin))
  return aheadMin + ((slot.ahead - aheadMin) / (aheadMax - aheadMin)) * span
}

export interface PlaceTracksideInput {
  table: ArcTable
  riderIndex: number
  camera: Vec3
  type: EnemyType
  groundFn: HeightFunction
  slots: readonly TracksideSlot[]
  ride: RideAhead
}

export function placeTracksideWave({ table, riderIndex, camera, type, groundFn, slots, ride }: PlaceTracksideInput): Vec3[] {
  const { surface } = ENEMY_PLACEMENT[type]
  const reach = maxReadableDistance(type)
  return slots.map((slot) => {
    const at = { ahead: tracksideAhead(table, surface, slot, ride), side: slot.side }
    const p = surface === 'water'
      ? wetTracksidePoint(table, riderIndex, at, groundFn, reach, ride.trackScale)
      : dryTracksidePoint(table, riderIndex, at, surface, groundFn, reach, ride.trackScale)
    return outsideNearField(settle(p, surface, groundFn), camera)
  })
}

function tracksidePoint(table: ArcTable, riderIndex: number, { ahead, side }: TracksideSlot): Vec3 {
  const i = indexAhead(table, riderIndex, ahead)
  const forward = horizontal(trackTangent(table, i))
  return { x: table.x[i] - forward.z * side, y: 0, z: table.z[i] + forward.x * side }
}

/** The slot, or the same spot across the track when only that side is in view on the approach (the inside of a turn). */
function dryTracksidePoint(
  table: ArcTable, riderIndex: number, slot: TracksideSlot, surface: Surface, groundFn: HeightFunction, reach: number, trackScale: number,
): Vec3 {
  const p = tracksidePoint(table, riderIndex, slot)
  if (inViewOnApproach(table, riderIndex, slot.ahead, settle(p, surface, groundFn), reach, trackScale)) return p
  const across = tracksidePoint(table, riderIndex, { ahead: slot.ahead, side: -slot.side })
  return inViewOnApproach(table, riderIndex, slot.ahead, settle(across, surface, groundFn), reach, trackScale) ? across : p
}

/**
 * The slot, or across the track, or nearer / further within the band: the first with sea under it
 * that is in view on its approach, else the first with sea under it, else the slot.
 */
function wetTracksidePoint(
  table: ArcTable, riderIndex: number, slot: TracksideSlot, groundFn: HeightFunction, reach: number, trackScale: number,
): Vec3 {
  const { aheadMin, aheadMax } = TRACKSIDE.water
  let wet: Vec3 | null = null
  for (let k = 0; k < WATER_SEARCH_TRIES; k++) {
    const step = (k % 2 === 0 ? 1 : -1) * Math.ceil(k / 2) * WATER_SEARCH_STEP
    const ahead = Math.min(aheadMax, Math.max(aheadMin, slot.ahead + step))
    for (const side of [slot.side, -slot.side]) {
      const p = tracksidePoint(table, riderIndex, { ahead, side })
      if (groundFn(p.x, p.z) >= WATER_DEPTH) continue
      if (inViewOnApproach(table, riderIndex, ahead, { x: p.x, y: WATER_Y, z: p.z }, reach, trackScale)) return p
      wet ??= p
    }
  }
  return wet ?? tracksidePoint(table, riderIndex, slot)
}

function inViewOnApproach(table: ArcTable, riderIndex: number, ahead: number, p: Vec3, reach: number, trackScale: number): boolean {
  const from = Math.max(0, ahead - VIEW_LEAD)
  for (const at of [from, from + VIEW_HOLD]) {
    const { eye, dir } = trackView(table, indexAhead(table, riderIndex, at), trackScale)
    const d = sub(p, eye)
    const len = Math.hypot(d.x, d.y, d.z)
    if (len > reach || dot(d, dir) < len * APPROACH_CONE_COS) return false
  }
  return true
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
