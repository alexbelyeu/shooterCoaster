/**
 * Level 2's ride (#864, from the ride kit's storyboard, `docs/RIDE-KIT.md`), pure: a v2 ride (gravity, speed zones,
 * beats) built by the ride elements' turtle (`src/track/elements/`) out to the Pyramid and back, in world units, laid out
 * along the line from the middle of the desert to the Pyramid (`LOCAL`: +x toward it, the Pyramid turned to face it).
 * The storyboard, with the second each beat lands (`BEATS`):
 *
 * - **0 s, the station** in the flats at the middle: GO launches it toward the Pyramid.
 * - **3–11 s, the lift hill**: a chain up over the dunes, the Pyramid growing ahead, the scorpions on the sand below.
 * - **11 s, the first drop**: over the top and down at 60° at the Pyramid's foot.
 * - **13–17 s, the dark ride**: in through a doorway in its second tier (its lintel the near miss) and along the passage
 *   through it in the dark, torches on the walls; out of its east face into the sandstorm (the crows' first V, 16 s).
 * - **17–24 s, the turn back**: a wide climbing U-turn round the Pyramid's east side and west along its south.
 * - **24 s, the canyon**: a jump gap between two mesas, the rails broken over the open ground between them.
 * - **31 s, the airtime hill**: a crest you float over as the crows' second V comes in (30 s).
 * - **40 s, the Giant Scorpion**: a slow helix round the flats in the middle, the boss on the sand beside it.
 * - **55–60 s, the brake run** into the station: home.
 *
 * `desertTrack.test.ts` holds it to the beats and its clearances (the ground, the Pyramid's passage, the canyon's mesas).
 * The level rides its copy in `desertLevel.ts` (`node scripts/gen-desert-level.mjs`), which keeps the ride elements out of
 * the startup JS.
 */
import type { RideBeat, RideMechanic, RideV2Spec, SpeedZone, TrackParams } from '@/types/level'
import { createSplineCurve, type RailPoint } from '@/track/curves/SplineCurve'
import { RideBuilder, type MarkerKind } from '@/track/elements/rideBuilder'
import { airtimeHill, bankedTurn } from '@/track/elements/elements'
import { climbingStraight, straightTo, trimUnrolledUps } from '@/track/elements/climbing'
import { jumpGap, placeMechanics, station } from '@/track/elements/mechanicElements'
import { getTrackDimensions } from '@/track/trackDimensions'
import { RIDE_V2_DEFAULTS } from '@/track/rideV2'
import { createHeightFunction } from '@/utils/terrainNoise'
import { PYRAMID_BASE_SIZE, PYRAMID_SHRINK } from '../../landmarkDimensions'
import { PYRAMID, PYRAMID_PASSAGE, PYRAMID_PASSAGE_FLOOR } from './landmarks'

/** The desert's structure scale: a big car over a big landscape. */
const SCALAR = 60
const EYE = getTrackDimensions({ scalar: SCALAR }).eyeHeight
/** Units between the turtle's control points. */
const SPACING = 60
const DEG = Math.PI / 180

/** The ride's frame: +x from the middle toward the Pyramid, turned `PYRAMID.yaw` about y into the world. */
const LOCAL = { cos: Math.cos(PYRAMID.yaw), sin: Math.sin(PYRAMID.yaw), pyramidX: Math.hypot(PYRAMID.x, PYRAMID.z) } as const

/** World XZ of a point on the ride's frame (as three.js turns a group by `rotation.y = yaw`). */
export function toWorld(p: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  return { x: p.x * LOCAL.cos + p.z * LOCAL.sin, y: p.y, z: -p.x * LOCAL.sin + p.z * LOCAL.cos }
}

/** Heading +x in the ride's frame (`RideBuilder`: +z at 0, a positive turn to the left, toward −z here). */
const EAST = Math.PI / 2

/** Speeds, world units a second. */
const SPEED = { launch: 200, lift: 110, passage: 110, turn: 150, jump: 330, finale: 95, brake: 40 } as const

const STATION = { x: -50, y: 25, z: 0 } as const
const LIFT = { from: 600, to: 1500, topY: 470 } as const
/** The first drop: over the crest and down at `angle` to the passage's rails. */
const DROP = { angle: 62 * DEG, crest: 160, foot: 230 } as const

/** The Pyramid's base: its centre's natural ground (`Features.tsx` stands it on the ground there; the ride never lowers it). */
export const PYRAMID_BASE_Y = createHeightFunction('desert')(PYRAMID.x, PYRAMID.z)
/** The rails through the passage, over its floor. */
const PASSAGE_RAIL = 18
const PASSAGE = {
  y: PYRAMID_BASE_Y + PYRAMID_PASSAGE_FLOOR + PASSAGE_RAIL,
  half: (PYRAMID_BASE_SIZE * PYRAMID_SHRINK ** PYRAMID_PASSAGE.layer) / 2,
} as const
/** The near miss: the run under the doorway's lintel, either side of the west face. */
const DOOR_RUN = 60

const TURN_BACK = { radius: 300, topY: 320 } as const
const CANYON = { fromX: 2150 } as const
const CAMEL = { toX: 700, y: 80, rise: 110, crest: 220, angle: 40 * DEG } as const
const FINALE = { homeTurn: 150 } as const

/** The storyboard's beats: the second the car reaches the `nth` element of a kind, its start or (`middle`) its middle. */
const BEATS: { kind: MarkerKind; second: number; nth?: number; at?: 'middle' | 'end' }[] = [
  { kind: 'liftHill', second: 11, at: 'end' },
  { kind: 'headChopper', second: 13, at: 'middle' },
  { kind: 'jumpGap', second: 24 },
  { kind: 'airtimeHill', second: 31, at: 'middle' },
  { kind: 'bankedTurn', nth: 1, second: 44 },
  { kind: 'bankedTurn', nth: 1, second: 57, at: 'end' },
]

export interface DesertRide {
  points: RailPoint[]
  markers: RideBuilder['markers']
  mechanics: RideMechanic[]
  zones: { kind: SpeedZone['kind']; from: number; to: number; speed: number; accel?: number }[]
  /** The passage through the Pyramid, by control point index: in at its west door, out at its east one. */
  passage: { from: number; to: number }
}

/** The ride, element by element, in its own frame. */
export function buildDesertRide(): DesertRide {
  const b = new RideBuilder({ ...STATION, heading: EAST, eyeHeight: EYE, spacing: SPACING })
  const mechanics: RideMechanic[] = []
  const zones: DesertRide['zones'] = []
  const zone = (kind: SpeedZone['kind'], speed: number, build: () => void, accel?: number) => {
    const from = b.points.length - 1
    build()
    zones.push({ kind, from, to: b.points.length - 1, speed, ...(accel ? { accel } : {}) })
  }
  const y = () => b.position.y
  const turn = (angle: number, radius: number, rise = 0, bank = 30 * DEG) => bankedTurn(b, { angle, radius, rise, bank, ease: 6 * EYE })

  // 0 s: the station; GO launches it at the Pyramid, a chain takes it up over the dunes.
  mechanics.push(station(b, { speed: SPEED.launch }))
  b.mark('straight', () => straightTo(b, 'x', LIFT.from))
  zone('lift', SPEED.lift, () => b.mark('liftHill', () => straightTo(b, 'x', LIFT.to, { rise: LIFT.topY - y(), ease: 15 * EYE })))
  // 11 s: over the top and the first drop at the Pyramid's foot, onto the passage's rails.
  const fall = y() - PASSAGE.y - DROP.crest * (1 - Math.cos(DROP.angle)) - DROP.foot * (1 - Math.cos(DROP.angle))
  b.mark('straight', () => {
    b.pitch(-DROP.angle, DROP.crest)
    b.straight(fall / Math.sin(DROP.angle))
    b.pitch(DROP.angle, DROP.foot)
  })
  // 13 s: in under the doorway's lintel and through the Pyramid in the dark.
  const door = LOCAL.pyramidX - PASSAGE.half
  zone('brake', SPEED.passage, () => b.mark('straight', () => straightTo(b, 'x', door - DOOR_RUN)), 600)
  const passageFrom = b.points.length - 1
  b.mark('headChopper', () => straightTo(b, 'x', door + DOOR_RUN))
  b.mark('straight', () => straightTo(b, 'x', LOCAL.pyramidX + PASSAGE.half))
  const passageTo = b.points.length - 1
  // 17 s: out into the sandstorm, a wide climbing U-turn round the Pyramid's east side and back west along its south.
  b.mark('straight', () => straightTo(b, 'x', LOCAL.pyramidX + PASSAGE.half + 100))
  zone('lift', SPEED.turn, () => turn(-Math.PI, TURN_BACK.radius, TURN_BACK.topY - y()))
  b.mark('straight', () => straightTo(b, 'x', CANYON.fromX))
  // 24 s: the canyon between two mesas, jumped.
  mechanics.push(jumpGap(b, { speed: SPEED.jump, booster: 12 * EYE, ramp: 20 * EYE }))
  // 31 s: down to the flats and over an airtime hill.
  b.mark('straight', () => straightTo(b, 'x', CAMEL.toX + 400, { rise: CAMEL.y - y(), ease: 20 * EYE }))
  airtimeHill(b, { rise: CAMEL.rise, crestRadius: CAMEL.crest, angle: CAMEL.angle })
  // 40 s: the Giant Scorpion's arena, a slow wide turn round the flats in the middle, the boss on the sand beside it.
  b.mark('straight', () => straightTo(b, 'x', STATION.x - FINALE.homeTurn))
  zone('lift', SPEED.finale, () => turn(-Math.PI, b.position.z / 2, STATION.y - y()))
  // 58 s: the brake run into the station.
  zone('brake', SPEED.brake, () => b.mark('straight', () => climbingStraight(b, STATION.x - SPACING - b.position.x)))
  return { points: b.points, markers: b.markers, mechanics, zones, passage: { from: passageFrom, to: passageTo } }
}

const toWorldPoint = (p: RailPoint): RailPoint => {
  const w = toWorld(p)
  if (!p.up) return w
  const u = toWorld(p.up)
  return { ...w, up: u }
}

/** The ride's v2 spec, mechanics, dark passage and the storyboard's beats placed on the built track. */
export function buildDesertTrack(): TrackParams {
  const ride = buildDesertRide()
  const points = trimUnrolledUps(ride.points).map(toWorldPoint)
  const curve = createSplineCurve(points)
  const share = (i: number) => curve.knotT(i)
  const zones: SpeedZone[] = ride.zones.map((z) => ({ ...z, from: share(z.from), to: share(z.to) }))
  const beats: RideBeat[] = BEATS.map(({ kind, second, nth = 0, at }) => {
    const m = ride.markers.filter((k) => k.kind === kind)[nth]
    if (!m) throw new Error(`desert ride: no ${kind} for its beat`)
    return { at: share(at === 'end' ? m.to : at === 'middle' ? Math.round((m.from + m.to) / 2) : m.from), second }
  })
  const rideV2: RideV2Spec = { zones, beats, drag: RIDE_V2_DEFAULTS.drag / 2 }
  // The passage rides dark (#752): the light goes over the doorway's run in and comes back over as long out.
  const ramp = share(ride.passage.from + 2) - share(ride.passage.from)
  const darkSections = [{ from: share(ride.passage.from), to: share(ride.passage.to) + ramp, ramp, flashReach: 400 }]
  return {
    curve: 'spline',
    controlPoints: points,
    scalar: SCALAR,
    ride: 'v2',
    rideV2,
    mechanics: placeMechanics(curve, ride.mechanics),
    darkSections,
    color1: 0x51411a,
    color2: 0x812a2a,
  }
}

export const DESERT_TRACK: TrackParams = buildDesertTrack()
