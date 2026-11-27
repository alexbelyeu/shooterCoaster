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
 * - **17–24 s, the turn back**: a wide climbing U-turn round the Pyramid's east side and west along its south, a swerve
 *   out into the storm and back onto the jump's line (21 s).
 * - **24 s, the canyon**: a jump gap between two mesas, the rails broken over the open ground between them.
 * - **26–29 s, the dune esses**: down to the flats left, right and left again, banked through the dunes.
 * - **31 s, the airtime hill**: a crest you float over as the crows' second V comes in (30 s).
 * - **34–44 s, the slalom** across the flats, slow, and the Giant Scorpion (40 s); then a wide turn round the flats in
 *   the middle, the boss on the sand beside it.
 * - **55–60 s, the brake run** into the station: home.
 *
 * `desertTrack.test.ts` holds it to the beats and its clearances (the ground, the Pyramid's passage, the canyon's mesas).
 * The level rides its copy in `desertLevel.ts` (`node scripts/gen-ride-levels.mjs level2`), which keeps the ride elements out of
 * the startup JS.
 */
import type { RideBeat, RideMechanic, RideV2Spec, SpeedZone, SplineTrackParams } from '@/types/level'
import { createSplineCurve, type RailPoint } from '@/track/curves/SplineCurve'
import { RideBuilder, type MarkerKind } from '@/track/elements/rideBuilder'
import { airtimeHill, bankedTurn } from '@/track/elements/elements'
import { climbingStraight, straightTo, trimUnrolledUps } from '@/track/elements/climbing'
import { jumpGap, placeMechanics, station } from '@/track/elements/mechanicElements'
import { getTrackDimensions } from '@/track/trackDimensions'
import { RIDE_V2_DEFAULTS } from '@/track/rideV2'
import { createHeightFunction } from '@/utils/terrainNoise'
import { PYRAMID_BASE_SIZE, PYRAMID_SHRINK } from '../../landmarkDimensions'
import { PYRAMID, PYRAMID_PASSAGE, PYRAMID_PASSAGE_FLOOR, RIDE_FRAME, rideFrameToWorld } from './landmarks'

/** The desert's structure scale: a big car over a big landscape. */
const SCALAR = 60
const EYE = getTrackDimensions({ scalar: SCALAR }).eyeHeight
/** Units between the turtle's control points. */
const SPACING = 60
const DEG = Math.PI / 180

/** The ride's yaw into the world (`desertLevel.ts` ships the ride in its own frame, `RIDE_FRAME`). */
export const DESERT_RIDE_YAW = PYRAMID.yaw
const LOCAL = RIDE_FRAME

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
/** The jump takes off from here, west over `CANYON` (`landmarks.ts`) between its two mesas. */
const JUMP = { fromX: 2150 } as const
const CAMEL = { y: 125, rise: 110, crest: 220, angle: 40 * DEG } as const
/** The esses (#1059): down from the jump through the dunes (left first, away from the arch south of the line), and across the flats. */
const STORM_ESSES = { angle: 32 * DEG, radius: 260, runIn: 320 } as const
const DUNE_ESSES = { angle: 55 * DEG, radius: 170 } as const
const FLAT_ESSES = { angle: -70 * DEG, radius: 150 } as const

/** The finale's turn among the ride's banked turns: after the turn back and the three esses' three each. */
const FINALE_TURN = 10

/** The storyboard's beats: the second the car reaches the `nth` element of a kind, its start or (`middle`) its middle. */
const BEATS: { kind: MarkerKind; second: number; nth?: number; at?: 'middle' | 'end' }[] = [
  { kind: 'liftHill', second: 11, at: 'end' },
  { kind: 'headChopper', second: 13, at: 'middle' },
  { kind: 'jumpGap', second: 24 },
  { kind: 'airtimeHill', second: 31, at: 'middle' },
  { kind: 'bankedTurn', nth: FINALE_TURN, second: 44 },
  { kind: 'bankedTurn', nth: FINALE_TURN, second: 57, at: 'end' },
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
  // An S: `angle` one way, twice it back and `angle` again, so it leaves on its heading; `rise` shared by length.
  const esses = ({ angle, radius }: { angle: number; radius: number }, rise = 0) => {
    turn(angle, radius, rise / 4)
    turn(-2 * angle, radius, rise / 2)
    turn(angle, radius, rise / 4)
  }

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
  // 21 s: a swerve through the storm on the run to the canyon, out away from the Pyramid and back onto the jump's line.
  b.mark('straight', () => b.straight(STORM_ESSES.runIn))
  esses(STORM_ESSES)
  b.mark('straight', () => straightTo(b, 'x', JUMP.fromX))
  // 24 s: the canyon between two mesas, jumped.
  mechanics.push(jumpGap(b, { speed: SPEED.jump, booster: 12 * EYE, ramp: 20 * EYE }))
  // 26 s: down to the flats through the dunes' esses, then over an airtime hill (31 s).
  esses(DUNE_ESSES, CAMEL.y - y())
  airtimeHill(b, { rise: CAMEL.rise, crestRadius: CAMEL.crest, angle: CAMEL.angle })
  // 35 s: across the flats in a slow slalom, and the Giant Scorpion's arena (40 s): a wide turn round the flats in the
  // middle, the boss on the sand beside it.
  esses(FLAT_ESSES)
  zone('lift', SPEED.finale, () => turn(-Math.PI, b.position.z / 2, STATION.y - y()))
  // 58 s: the brake run into the station.
  zone('brake', SPEED.brake, () => b.mark('straight', () => climbingStraight(b, STATION.x - SPACING - b.position.x)))
  return { points: b.points, markers: b.markers, mechanics, zones, passage: { from: passageFrom, to: passageTo } }
}

const toWorldPoint = (p: RailPoint): RailPoint => (p.up ? { ...rideFrameToWorld(p), up: rideFrameToWorld(p.up) } : rideFrameToWorld(p))

/** The ride's v2 spec, mechanics, dark passage and the storyboard's beats placed on the built track. */
export function buildDesertTrack(): SplineTrackParams {
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
  // The passage rides dark (#752): the light goes over the doorway's run in and comes back over as long out. Its floor
  // holds a scorpion wave (#937).
  const ramp = share(ride.passage.from + 2) - share(ride.passage.from)
  const floor = { below: PASSAGE_RAIL, halfWidth: PYRAMID_PASSAGE.width / 2 }
  const darkSections = [{ from: share(ride.passage.from), to: share(ride.passage.to) + ramp, ramp, flashReach: 400, floor }]
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

export const DESERT_TRACK: SplineTrackParams = buildDesertTrack()
