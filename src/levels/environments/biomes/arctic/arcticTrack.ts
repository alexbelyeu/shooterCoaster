/**
 * Level 4's ride (#866, from the ride kit's storyboard, `docs/RIDE-KIT.md`), pure: a v2 ride (gravity, speed zones,
 * beats) built by the ride elements' turtle (`src/track/elements/`) through the Antarctic valley, in world units. The
 * storyboard, with the second each beat lands (`BEATS`):
 *
 * - **0 s, the station** on the valley floor west of the centre: GO launches it east.
 * - **3–10 s, the lift hill**: a chain east up the valley, the scouts' line along it.
 * - **11 s, the first drop**: round south at the top and down the far side into the canyon.
 * - **13–17 s, the ice cave**: under the cave's low mouth (the near miss) and through it in the blue dark, south.
 * - **18–22 s, the ridge**: out of the cave into the blizzard, a climbing turn east up onto the ridge.
 * - **24 s, the airtime crest** off the ridge, east into the aurora, the Ice Fortress ahead on the left.
 * - **27–40 s, the bobsled helix**: one and a half turns down the glacier beside the fortress, which wheels round the
 *   frame; it comes out heading west as the Yeti arrives (40 s).
 * - **40–58 s, the Yeti's valley**: a long, slow run west and round north for the fight.
 * - **After the run, home**: the brake run into the station.
 *
 * `arcticTrack.test.ts` holds it to the beats and to its clearances (the fortress, the ice cave, its own other passes).
 */
import type { DarkSectionSpec, RideBeat, RideMechanic, RideV2Spec, SpeedZone, SplineTrackParams } from '@/types/level'
import { createSplineCurve } from '@/track/curves/SplineCurve'
import { RideBuilder, type MarkerKind } from '@/track/elements/rideBuilder'
import { airtimeHill, bankedTurn, helix } from '@/track/elements/elements'
import { straightTo, trimUnrolledUps } from '@/track/elements/climbing'
import { placeMechanics, station } from '@/track/elements/mechanicElements'
import { getTrackDimensions } from '@/track/trackDimensions'
import { RIDE_V2_DEFAULTS } from '@/track/rideV2'
import { buildArcTable } from '@/track/arcLength'
import { ICE_CAVE } from './iceCaveGeometry'

/** Level 4's structure scale. */
const SCALAR = 35
const EYE = getTrackDimensions({ scalar: SCALAR }).eyeHeight
/** Units between the turtle's control points. */
const SPACING = 100
const DEG = Math.PI / 180

/** Headings (`RideBuilder`: +z at 0, +x at a quarter turn). */
const EAST = Math.PI / 2

/** Speeds, world units a second. */
const SPEED = { launch: 220, lift: 120, crest: 100, cave: 200, lift2: 100, helix: 170, valley: 150, brake: 70 } as const

const STATION = { x: -500, y: 20, z: 300 } as const
const LIFT = { from: -150, to: 350, topY: 330 } as const
/** The crest's turn south, and the drop down the far side to the cave's floor. */
const CREST_RADIUS = 200
const DROP = { toZ: -180, bottomY: 40, ease: 220 } as const
/** The ice cave (`iceCaveGeometry.ts`): south from the drop's foot, under its low mouth. */
const CAVE = { toZ: -900 } as const
/** Out of the cave, east up onto the ridge. */
const RIDGE = { radius: 250, rise: 100, toX: 950, topY: 290, dropTo: 1150, dropY: 170 } as const
const CREST = { rise: 80, crestRadius: 240, angle: 30 * DEG } as const
/** The helix: its centre north of the ridge's line, a few hundred units west of the fortress. */
const HELIX = { radius: 220, turns: 1.25, drop: 120, bank: 35 * DEG, fromX: 1750 } as const
/** The Yeti's valley: north up the fortress's side of the valley, then west along its north side. */
const VALLEY = { toZ: 600, turn: 300, y: 60 } as const
/** Home: down the west side and round east into the station. */
const HOME = { x: -1100, turn: 250 } as const

/** The storyboard's beats: the second the car reaches the `nth` element of a kind, its start or (`middle`) its middle. */
const BEATS: { kind: MarkerKind; second: number; nth?: number; at?: 'middle' | 'end' }[] = [
  { kind: 'liftHill', second: 3 },
  { kind: 'airtimeHill', second: 27, at: 'middle' },
  { kind: 'helix', second: 40, at: 'end' },
]

export interface ArcticRide {
  points: RideBuilder['points']
  markers: RideBuilder['markers']
  mechanics: RideMechanic[]
  zones: { kind: SpeedZone['kind']; from: number; to: number; speed: number; accel?: number }[]
  /** The ice cave, by control point index. */
  cave: { from: number; to: number }
}

export function buildArcticRide(): ArcticRide {
  const b = new RideBuilder({ ...STATION, heading: EAST, eyeHeight: EYE, spacing: SPACING })
  const mechanics: RideMechanic[] = []
  const zones: ArcticRide['zones'] = []
  const zone = (kind: SpeedZone['kind'], speed: number, build: () => void, accel?: number) => {
    const from = b.points.length - 1
    build()
    zones.push({ kind, from, to: b.points.length - 1, speed, ...(accel ? { accel } : {}) })
  }
  const y = () => b.position.y
  const turn = (angle: number, radius: number, rise = 0, bank = 30 * DEG) => bankedTurn(b, { angle, radius, rise, bank, ease: 3 * EYE })

  mechanics.push(station(b, { speed: SPEED.launch }))
  b.mark('straight', () => straightTo(b, 'x', LIFT.from))
  zone('lift', SPEED.lift, () => b.mark('liftHill', () => straightTo(b, 'x', LIFT.to, { rise: LIFT.topY - y(), ease: 8 * EYE })))
  zone('lift', SPEED.crest, () => turn(Math.PI / 2, CREST_RADIUS, 0, 15 * DEG))
  b.mark('straight', () => straightTo(b, 'z', DROP.toZ, { rise: DROP.bottomY - y(), ease: DROP.ease }))
  const caveFrom = b.points.length - 1
  zone('brake', SPEED.cave, () => {
    b.mark('headChopper', () => straightTo(b, 'z', DROP.toZ - ICE_CAVE.mouth))
    b.mark('straight', () => straightTo(b, 'z', CAVE.toZ))
  })
  const caveTo = b.points.length - 1
  zone('lift', SPEED.lift2, () => {
    turn(-Math.PI / 2, RIDGE.radius, RIDGE.rise)
    b.mark('liftHill', () => straightTo(b, 'x', RIDGE.toX, { rise: RIDGE.topY - y(), ease: 8 * EYE }))
  })
  b.mark('straight', () => straightTo(b, 'x', RIDGE.dropTo, { rise: RIDGE.dropY - y(), ease: 14 * EYE }))
  airtimeHill(b, CREST)
  b.mark('straight', () => straightTo(b, 'x', HELIX.fromX))
  zone('brake', SPEED.helix, () => helix(b, { radius: HELIX.radius, turns: HELIX.turns, drop: HELIX.drop, bank: HELIX.bank, hand: -1 }))
  zone('lift', SPEED.valley, () => {
    b.mark('straight', () => straightTo(b, 'z', VALLEY.toZ, { rise: VALLEY.y - y(), ease: 6 * EYE }))
    turn(-Math.PI / 2, VALLEY.turn)
    b.mark('straight', () => straightTo(b, 'x', HOME.x + HOME.turn))
  })
  zone('brake', SPEED.brake, () => {
    turn(-Math.PI / 2, HOME.turn, STATION.y - y())
    b.mark('straight', () => straightTo(b, 'z', STATION.z + HOME.turn))
    turn(-Math.PI / 2, HOME.turn)
  })
  b.mark('straight', () => straightTo(b, 'x', STATION.x - SPACING))
  return { points: b.points, markers: b.markers, mechanics, zones, cave: { from: caveFrom, to: caveTo } }
}

/** The ride's v2 spec, mechanics, ice cave and the storyboard's beats placed on the built track. */
export function buildArcticTrack(): SplineTrackParams {
  const ride = buildArcticRide()
  const points = trimUnrolledUps(ride.points)
  const curve = createSplineCurve(points)
  const share = (i: number) => curve.knotT(i)
  const zones: SpeedZone[] = ride.zones.map((z) => ({ ...z, from: share(z.from), to: share(z.to) }))
  const beats: RideBeat[] = BEATS.map(({ kind, second, nth = 0, at }) => {
    const m = ride.markers.filter((k) => k.kind === kind)[nth]
    if (!m) throw new Error(`arctic ride: no ${kind} for its beat`)
    return { at: share(at === 'end' ? m.to : at === 'middle' ? Math.round((m.from + m.to) / 2) : m.from), second }
  })
  const rideV2: RideV2Spec = { zones, beats, drag: RIDE_V2_DEFAULTS.drag / 2 }
  const length = buildArcTable(curve).length
  // Dark from the mouth, fully once under the vault; the snowmen beside the track are within the muzzle flash's reach.
  const darkSections: DarkSectionSpec[] = [
    { from: share(ride.cave.from), to: share(ride.cave.to), ramp: ICE_CAVE.mouth / length, flashReach: ICE_CAVE.halfWidth, look: 'ice' },
  ]
  return {
    curve: 'spline',
    controlPoints: points,
    scalar: SCALAR,
    ride: 'v2',
    rideV2,
    mechanics: placeMechanics(curve, ride.mechanics),
    darkSections,
    color1: 0x909090,
    color2: 0xffffff,
  }
}

export const ARCTIC_TRACK: SplineTrackParams = buildArcticTrack()
