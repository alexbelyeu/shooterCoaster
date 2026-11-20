import type { EnemyType, Formation, FormationOrigin, WallSurface } from '@/types/level'
import type { ArcTable } from '@/track/arcLength'
import { rideProfile, riddenBetween, type RideSpeeds } from '@/track/ridePhysics'
import { RUN_SECONDS } from '@/levels/pacing'
import { waveWindows } from './waveSchedule'
import type { HeightFunction } from '@/utils/terrainNoise'
import type { Rng } from '@/utils/rng'
import { maxReadableDistance } from '../enemies/enemyReadability'
import {
  BYSTANDER_SPACING, ENEMY_PLACEMENT, WATER_DEPTH, WATER_Y, wallNormal, wallPoint, type Surface, type SwarmSlot, type WallSlot,
} from './enemyPlacement'
import { CLIMB } from '../enemies/climbMotion'
import { HOP } from '../enemies/hopGlideMotion'
import { LOOK_AHEAD_UNITS, lookAheadDirection } from '@/track/cameraRig.hot'
import { MIN_HORIZONTAL_FOV } from '@/track/cameraFov.hot'

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
  /** Arc distance the rider covers while the wave flies in (`ENTRY_SECONDS_MAX`). */
  entry: number
  /** Arc distance the rider covers over the wave's window (until the next wave, the boss or the end of the run), less `RIDE_PACE_SLACK`. */
  window: number
  /** The level's structure scale: the rig looks `LOOK_AHEAD_UNITS` × this ahead. */
  trackScale: number
}

/** A formation member flies in over `ENTRY_SECONDS`, the last of its group `ENTRY_STAGGER` later. */
export const ENTRY_SECONDS = 1.2
export const ENTRY_STAGGER = 0.6
/** The longest fly-in of an arriving enemy. */
export const ENTRY_SECONDS_MAX = ENTRY_SECONDS + ENTRY_STAGGER

/**
 * A run may ride less far than its profile (`rideProfile`: slow-mo and a capped hitch slow the ride, not the level
 * timer), so a wave spreads over this share of the arc its window predicts, and the rider still reaches its last.
 */
export const RIDE_PACE_SLACK = 0.85

/** Each wave's `RideAhead`: the ride a run takes from GO, over the wave's fly-in and its window (`waveWindows`). */
export function rideAheadOfWaves(
  table: ArcTable,
  speeds: RideSpeeds,
  delays: readonly number[],
  bossAt: number | undefined,
  trackScale: number,
): RideAhead[] {
  const profile = rideProfile(table, speeds, RUN_SECONDS)
  return waveWindows(delays, bossAt, RUN_SECONDS).map(([from, to]) => ({
    entry: riddenBetween(profile, from, from + ENTRY_SECONDS_MAX),
    window: RIDE_PACE_SLACK * riddenBetween(profile, from, to),
    trackScale,
  }))
}

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
 * How a member moves once it has entered: the whole group on one XZ heading (`atan2(dz, dx)`) so its shape holds,
 * from when the rider comes within `startWithin` of the group's `anchor` (#472: a group placed far ahead would
 * otherwise march off before the rider gets there), or bobbing at its slot. Absent: the enemy's own wander.
 */
export type FormationMotion = { kind: 'march'; heading: number; anchor: Vec3; startWithin: number } | { kind: 'hold' }

/** The group heading of a marching member, else undefined. */
export function marchHeading(motion: FormationMotion | undefined): number | undefined {
  return motion?.kind === 'march' ? motion.heading : undefined
}

/** Whether a member may move from `eye`: false only while its group waits for the rider to reach it. */
export function marchMoving(motion: FormationMotion | undefined, eye: Vec3): boolean {
  if (motion?.kind !== 'march') return true
  const { anchor } = motion
  return Math.hypot(eye.x - anchor.x, eye.y - anchor.y, eye.z - anchor.z) <= motion.startWithin
}

/** An interior's walls and roof, already inset: every placement stays inside (the gym's hall, `BiomeDefinition.bounds`). */
export interface PlacementBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  maxY: number
}

/** A circle (XZ) a ground enemy stood away from the track keeps out of: a landmark or a big prop (`BiomeDefinition.keepOff`). */
export interface KeepOff {
  x: number
  z: number
  r: number
}

export function insideBounds(p: Vec3, b: PlacementBounds): boolean {
  return p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ && p.y <= b.maxY
}

/** `p` moved to the nearest point inside `b`, or `p` itself with no bounds. */
export function clampToBounds(p: Vec3, b: PlacementBounds | undefined): Vec3 {
  return b ? clampIntoBounds({ x: p.x, y: p.y, z: p.z }, b) : p
}

/** `clampToBounds` in place, for per-frame callers (the intro camera). */
export function clampIntoBounds<T extends Vec3>(p: T, b: PlacementBounds | undefined): T {
  if (!b) return p
  p.x = Math.min(b.maxX, Math.max(b.minX, p.x))
  p.y = Math.min(p.y, b.maxY)
  p.z = Math.min(b.maxZ, Math.max(b.minZ, p.z))
  return p
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
  bounds?: PlacementBounds
}

/** World placements for a formation wave's slots, in slot order. */
export function placeFormationWave(input: PlaceWaveInput): Placement[] {
  const { table, riderIndex, camera, formation, type, groundFn, slots, ride, bounds } = input
  // Inside an interior's walls, back on its surface (a clamped air slot keeps its clearance under the roof).
  const keepIn = (p: Vec3) => (bounds ? clampToBounds(settle(clampToBounds(p, bounds), surface, groundFn), bounds) : p)
  const surface = ENEMY_PLACEMENT[type].surface
  const reach = maxReadableDistance(type)
  const groups = slots.reduce((n, s) => Math.max(n, s.group + 1), 0)
  const step = groupStep(table, formation, groups, ride)
  const frames = new Map<number, { f: FormationFrame; motion: FormationMotion | undefined }>()
  const frameFor = (group: number) => {
    let framed = frames.get(group)
    if (!framed) {
      const members = slots.filter((s) => s.group === group)
      const centre = members.reduce(
        (c, s) => ({ x: c.x + s.local.x / members.length, y: c.y + s.local.y / members.length, z: c.z + s.local.z / members.length }),
        { x: 0, y: 0, z: 0 },
      )
      const at = (origin?: FormationOrigin) => formationFrame(table, riderIndex, formation, group, ride, reach, step, origin, centre)
      let f = at(input.origin)
      if (surface === 'water') f = findWater(at, input.origin ?? FORMATIONS[formation].origin, groundFn, f)
      framed = { f, motion: formationMotion(formation, f, slotWorld(formation, f, centre), reach) }
      frames.set(group, framed)
    }
    return framed
  }

  return slots.map((slot) => {
    const { f, motion } = frameFor(slot.group)
    let local = slot.local
    let position = settle(slotWorld(formation, f, local), surface, groundFn)
    // A fish whose slot is on the shore closes in toward the wet group centre.
    for (let k = 0; k < SHORE_PULL_TRIES && surface === 'water' && groundFn(position.x, position.z) >= WATER_DEPTH; k++) {
      local = { x: local.x * 0.5, y: local.y, z: local.z * 0.5 }
      position = settle(slotWorld(formation, f, local), surface, groundFn)
    }
    const { from, spin } = entryStart(formation, f, position, groundFn)
    return {
      position: keepIn(outsideNearField(keepIn(position), camera)),
      from: keepIn(outsideNearField(keepIn(from), camera)),
      spin,
      entrySeconds: ENTRY_SECONDS + (ENTRY_STAGGER * slot.index) / Math.max(1, slot.groupSize - 1),
      motion,
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

/** `anchor`: the group centre its frame was checked in view of, within `reach`, from where the rider will be. */
function formationMotion(formation: ChoreographedFormation, f: FormationFrame, anchor: Vec3, reach: number): FormationMotion | undefined {
  switch (formation) {
    case 'v':
    case 'line': // at the rider
      return { kind: 'march', heading: Math.atan2(-f.forward.z, -f.forward.x), anchor, startWithin: reach }
    case 'school': // across the track
      return { kind: 'march', heading: Math.atan2(f.right.z * -f.sideSign, f.right.x * -f.sideSign), anchor, startWithin: reach }
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
  bounds?: PlacementBounds
  keepOff?: readonly KeepOff[]
}

export function placeTracksideWave({ table, riderIndex, camera, type, groundFn, slots, ride, bounds, keepOff = [] }: PlaceTracksideInput): Vec3[] {
  const { surface } = ENEMY_PLACEMENT[type]
  const reach = maxReadableDistance(type)
  return slots.map((slot) => {
    const at = { ahead: tracksideAhead(table, surface, slot, ride), side: slot.side }
    const p = surface === 'water'
      ? wetTracksidePoint(table, riderIndex, at, groundFn, reach, ride.trackScale)
      : dryTracksidePoint(table, riderIndex, at, surface, groundFn, reach, ride.trackScale, bounds, keepOff)
    const placed = outsideNearField(settle(p, surface, groundFn), camera)
    const out = surface === 'ground' ? groundedOutsideNearField(placed, camera, groundFn) : placed
    return bounds && !insideBounds(out, bounds) ? settle(clampToBounds(out, bounds), surface, groundFn) : out
  })
}

/** A pushed ground enemy back on the ground (a camera close above, as over the gym's pit, pushes it down), pushed again till clear. */
function groundedOutsideNearField(p: Vec3, camera: Vec3, groundFn: HeightFunction): Vec3 {
  let q = settle(p, 'ground', groundFn)
  for (let k = 0; k < 4 && Math.hypot(q.x - camera.x, q.y - camera.y, q.z - camera.z) < NEAR_FIELD; k++) {
    // Out along the ground to the near field's edge at this height.
    const dx = q.x - camera.x
    const dz = q.z - camera.z
    const h = Math.hypot(dx, dz) || 1e-6
    const need = Math.sqrt(Math.max(NEAR_FIELD ** 2 - (q.y - camera.y) ** 2, 0)) + 0.01
    q = settle({ x: camera.x + (dx / h) * need, y: q.y, z: camera.z + (dz / h) * need }, 'ground', groundFn)
  }
  return q
}

function tracksidePoint(table: ArcTable, riderIndex: number, { ahead, side }: TracksideSlot): Vec3 {
  const i = indexAhead(table, riderIndex, ahead)
  const forward = horizontal(trackTangent(table, i))
  return { x: table.x[i] - forward.z * side, y: 0, z: table.z[i] + forward.x * side }
}

/** Shares of a slot's side tried nearer the track: inside an interior when its spot is past the walls, and by `bestFacingAround`. */
const SIDE_SCALES = [1, 0.6, 0.35, 0]

/**
 * The slot, or the same spot across the track when only that side is in view on the approach (the inside of a turn);
 * inside `bounds`, also nearer the track. When none is (a tight turn faces the rider away from both sides of the
 * slot's stretch until the last moment, #543): the spot round the slot's track point, clear of the rails, that the
 * rider faces most squarely on the near approach, if that one is in view on the approach; else whichever of it and
 * the spot out along the approach's look (`whereTheApproachLooks`, #494) more of the approach's looks see.
 */
function dryTracksidePoint(
  table: ArcTable, riderIndex: number, slot: TracksideSlot, surface: Surface, groundFn: HeightFunction, reach: number, trackScale: number,
  bounds: PlacementBounds | undefined, keepOff: readonly KeepOff[],
): Vec3 {
  const { sideMin } = TRACKSIDE.ground
  for (const scale of bounds ? SIDE_SCALES : [1]) {
    const offset = Math.max(sideMin, Math.abs(slot.side) * scale) * Math.sign(slot.side)
    for (const side of [offset, -offset]) {
      const p = tracksidePoint(table, riderIndex, { ahead: slot.ahead, side })
      if (bounds && !insideBounds(p, bounds)) continue
      if (inViewOnApproach(table, riderIndex, slot.ahead, settle(p, surface, groundFn), reach, trackScale)) return p
    }
  }
  const around = bestFacingAround(table, riderIndex, slot, surface, groundFn, reach, trackScale, bounds)
  if (around && inViewOnApproach(table, riderIndex, slot.ahead, settle(around, surface, groundFn), reach, trackScale)) return around
  // Not in an interior: its boulders and pieces stand on the floor, and nothing keeps a spot off them.
  const looked = bounds ? null : whereTheApproachLooks(table, riderIndex, slot, surface, groundFn, reach, trackScale, keepOff)
  const aroundSeen = around ? looksInView(table, riderIndex, slot.ahead, settle(around, surface, groundFn), reach, trackScale) : -1
  return (looked && looked.seen > aroundSeen ? looked.p : around) ?? clampToBounds(tracksidePoint(table, riderIndex, slot), bounds)
}

/** Distances out along the rider's look tried by `whereTheApproachLooks`, nearest first. */
const LOOK_SPOT_FIRST = 300
const LOOK_SPOT_STEP = 100

/**
 * A blind approach (#494: Desert's opening climb, pitched at the sky, the track beyond its crest dropping and turning
 * away): no spot near the slot's stretch of track is in view while the rider closes on it. The spot out along the look
 * from the middle of that approach instead, offset by the slot's side: off every rail and out of `keepOff`, at the
 * distance the most of the approach's looks see (`looksInView`; the nearest of equals). Null if none is.
 */
function whereTheApproachLooks(
  table: ArcTable, riderIndex: number, slot: TracksideSlot, surface: Surface, groundFn: HeightFunction, reach: number, trackScale: number,
  keepOff: readonly KeepOff[],
): { p: Vec3; seen: number } | null {
  const { eye, dir } = trackView(table, indexAhead(table, riderIndex, Math.max(0, slot.ahead - VIEW_LEAD) + VIEW_HOLD), trackScale)
  const look = horizontal(dir)
  let best: { p: Vec3; seen: number } | null = null
  for (let d = LOOK_SPOT_FIRST; d < reach; d += LOOK_SPOT_STEP) {
    const p = { x: eye.x + look.x * d - look.z * slot.side, y: 0, z: eye.z + look.z * d + look.x * slot.side }
    if (keepOff.some((c) => Math.hypot(p.x - c.x, p.z - c.z) < c.r)) continue
    if (!clearOfTrack(table, p, TRACKSIDE.ground.sideMin)) continue
    const seen = looksInView(table, riderIndex, slot.ahead, settle(p, surface, groundFn), reach, trackScale)
    if (seen > (best?.seen ?? 0)) best = { p, seen }
  }
  return best
}

/** How many of the approach's looks, every `FACING_STEP` from `VIEW_LEAD` to `FACING_LAST` before the slot, have `p` in their cone. */
function looksInView(table: ArcTable, riderIndex: number, ahead: number, p: Vec3, reach: number, trackScale: number): number {
  let seen = 0
  for (let at = Math.max(0, ahead - VIEW_LEAD); at <= ahead - FACING_LAST; at += FACING_STEP) {
    if (lookCos(table, riderIndex, at, p, reach, trackScale) >= APPROACH_CONE_COS) seen++
  }
  return seen
}

/** `clearOfTrack` checks every sixth track sample (~20 units apart on Desert's lap). */
const TRACK_CHECK_STRIDE = 6

/** At least `clearance` from every rail of the lap (and the towers under them). */
function clearOfTrack(table: ArcTable, p: Vec3, clearance: number): boolean {
  for (let j = 0; j < table.count; j += TRACK_CHECK_STRIDE) {
    if (Math.hypot(p.x - table.x[j], p.z - table.z[j]) < clearance) return false
  }
  return true
}

/** Directions tried round a slot's track point, the first on the slot's side. */
const AROUND_DIRECTIONS = 12

/**
 * The spot within the slot's side distance of its track point, inside `bounds` and at least `sideMin` from the rails
 * near it, that the rider faces most squarely on the near approach (`approachFacing`); null if none is clear.
 */
function bestFacingAround(
  table: ArcTable, riderIndex: number, slot: TracksideSlot, surface: Surface, groundFn: HeightFunction, reach: number, trackScale: number,
  bounds?: PlacementBounds,
): Vec3 | null {
  const { sideMin } = TRACKSIDE.ground
  const i = indexAhead(table, riderIndex, slot.ahead)
  const forward = horizontal(trackTangent(table, i))
  let best: Vec3 | null = null
  let bestFacing = -Infinity
  for (const scale of SIDE_SCALES) {
    const r = Math.max(sideMin, Math.abs(slot.side) * scale)
    for (let k = 0; k < AROUND_DIRECTIONS; k++) {
      const a = (k / AROUND_DIRECTIONS) * 2 * Math.PI
      const right = Math.cos(a) * Math.sign(slot.side) * r
      const along = Math.sin(a) * r
      const p = { x: table.x[i] - forward.z * right + forward.x * along, y: 0, z: table.z[i] + forward.x * right + forward.z * along }
      if (bounds && !insideBounds(p, bounds)) continue
      if (!clearOfRails(table, i, p, sideMin)) continue
      const f = approachFacing(table, riderIndex, slot.ahead, settle(p, surface, groundFn), reach, trackScale)
      if (f > bestFacing) {
        best = p
        bestFacing = f
      }
    }
  }
  return best
}

/** Arc either side of a slot's track point whose rails a spot round it keeps `clearance` from, sampled every step. */
const RAIL_CHECK_ARC = 600
const RAIL_CHECK_STEP = 20

function clearOfRails(table: ArcTable, index: number, p: Vec3, clearance: number): boolean {
  for (let a = -RAIL_CHECK_ARC; a <= RAIL_CHECK_ARC; a += RAIL_CHECK_STEP) {
    const j = indexAhead(table, index, a)
    if (Math.hypot(p.x - table.x[j], p.z - table.z[j]) < clearance) return false
  }
  return true
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
  return lookCos(table, riderIndex, from, p, reach, trackScale) >= APPROACH_CONE_COS
    && lookCos(table, riderIndex, from + VIEW_HOLD, p, reach, trackScale) >= APPROACH_CONE_COS
}

/** The looks `approachFacing` sums: every `FACING_STEP` from the second look of `inViewOnApproach` to `FACING_LAST` before the slot. */
const FACING_STEP = 100
const FACING_LAST = 300

/** How squarely the rider faces `p` over the near approach, summed over its looks. */
function approachFacing(table: ArcTable, riderIndex: number, ahead: number, p: Vec3, reach: number, trackScale: number): number {
  let sum = 0
  for (let at = Math.max(0, ahead - VIEW_LEAD + VIEW_HOLD); at <= ahead - FACING_LAST; at += FACING_STEP) {
    sum += lookCos(table, riderIndex, at, p, reach, trackScale)
  }
  return sum
}

/** Cosine between the rider's look `at` past `riderIndex` and the way to `p`; -1 past `reach`. */
function lookCos(table: ArcTable, riderIndex: number, at: number, p: Vec3, reach: number, trackScale: number): number {
  const { eye, dir } = trackView(table, indexAhead(table, riderIndex, at), trackScale)
  const d = sub(p, eye)
  const len = Math.hypot(d.x, d.y, d.z)
  return len > reach ? -1 : dot(d, dir) / len
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

/** Views of the rider a swarm's wall is judged from, over the first part of its window. */
const SWARM_VIEWS = 6
const SWARM_WINDOW_SHARE = 0.6
/** Candidate centres along each wall, about this far apart. */
const SWARM_CANDIDATE_STEP = 80
/** The rider must see the wall's face at least this square-on (the cosine): not edge-on. */
const SWARM_MIN_FACING = 0.25

export interface PlaceSwarmInput {
  table: ArcTable
  riderIndex: number
  type: EnemyType
  walls: readonly WallSurface[]
  slots: readonly SwarmSlot[]
  ride: RideAhead
}

/**
 * A swarm's wall and its members' spots on it (#516): the centre, of a few along each wall, that the rider sees face-on
 * and within reading distance in the most views over the wave's window, the nearest at the first of them on a tie.
 */
export function placeWallSwarm({ table, riderIndex, type, walls, slots, ride }: PlaceSwarmInput): WallSlot[] {
  if (walls.length === 0) throw new Error("wall enemies need the level's walls (LevelConfig.walls)")
  const reach = maxReadableDistance(type)
  const views: TrackView[] = []
  for (let j = 0; j < SWARM_VIEWS; j++) {
    const ahead = ride.entry + (ride.window * SWARM_WINDOW_SHARE * j) / (SWARM_VIEWS - 1)
    views.push(trackView(table, indexAhead(table, riderIndex, ahead), ride.trackScale))
  }
  const spot = { x: 0, y: 0, z: 0 }
  let best = { wall: walls[0], u: walls[0].width / 2, v: walls[0].height / 2 }
  let bestSeen = -1
  let bestDist = Infinity
  for (const wall of walls) {
    const normal = wallNormal(wall)
    const v = Math.min(wall.height / 2, Math.max(HOP.margin, wall.height * 0.4))
    const steps = Math.max(1, Math.round(wall.width / SWARM_CANDIDATE_STEP))
    for (let i = 0; i < steps; i++) {
      const u = (wall.width * (i + 0.5)) / steps
      wallPoint(wall, u, v, 0, spot, normal)
      let seen = 0
      for (const view of views) {
        const d = sub(view.eye, spot)
        const facing = (d.x * normal.x + d.y * normal.y + d.z * normal.z) / Math.max(1e-6, Math.hypot(d.x, d.y, d.z))
        if (facing >= SWARM_MIN_FACING && inView(view, spot, reach)) seen++
      }
      const dist = Math.hypot(spot.x - views[0].eye.x, spot.y - views[0].eye.y, spot.z - views[0].eye.z)
      if (seen > bestSeen || (seen === bestSeen && dist < bestDist)) {
        best = { wall, u, v }
        bestSeen = seen
        bestDist = dist
      }
    }
  }
  const { wall } = best
  const mu = Math.min(HOP.margin, wall.width / 2)
  const mv = Math.min(HOP.margin, wall.height / 2)
  return slots.map((s) => ({
    wall,
    u: Math.min(wall.width - mu, Math.max(mu, best.u + s.du)),
    v: Math.min(wall.height - mv, Math.max(mv, best.v + s.dv)),
    seed: s.seed,
  }))
}

/**
 * Bystander climbers (#518) at the foot of the wall a swarm would take (`placeWallSwarm`: the one the rider sees most over
 * the wave's window), in a row across it round that spot, closer together on a narrow wall. `slots` are `bystanderSlots`.
 */
export function placeWallClimbers(input: PlaceSwarmInput): WallSlot[] {
  const [{ wall, u }] = placeWallSwarm({ ...input, slots: [{ du: 0, dv: 0, seed: 0 }] })
  const n = input.slots.length
  const margin = Math.min(CLIMB.margin, wall.width / 2)
  const spacing = Math.min(BYSTANDER_SPACING, (wall.width - 2 * margin) / Math.max(1, n))
  const row = spacing * (n - 1)
  const first = Math.min(wall.width - margin - row, Math.max(margin, u - row / 2))
  return input.slots.map((s, i) => ({
    wall,
    u: Math.min(wall.width - margin, Math.max(margin, first + i * spacing + s.du * (spacing / BYSTANDER_SPACING))),
    v: s.dv * wall.height,
    seed: s.seed,
  }))
}
