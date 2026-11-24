/**
 * Level 7's ride (#871, from the ride kit's storyboard, `docs/RIDE-KIT.md`), pure: a v2 ride (gravity, speed zones, beats)
 * built by the ride elements' turtle (`src/track/elements/`) down Neon Metropolis's streets (`STREET_GRID`: their centre
 * lines lie at odd multiples of 120), in world units, north being -z. The storyboard, with the second each beat lands
 * (`BEATS`):
 *
 * - **0 s, the station** on the avenue south of the centre: GO launches it east between the neon signs.
 * - **5–13 s, the lift hill**: round north and up a chain beside the lift tower's face, drones alongside.
 * - **15 s, the first drop**: round east at the top and down (66°) between the two drop towers into the street below.
 * - **20.5 s, the head-chopper**: north under the elevated train line's deck, a train standing on it (the near miss).
 * - **26 s, the airtime crest** west along the north side, the hero tower ahead.
 * - **31–40 s, the helix**: a climbing turn and a quarter round the hero tower; it comes out as the helicopter arrives (40 s).
 * - **40–60 s, the face-off**: a slow run back south through the west side's streets for the fight.
 * - **After the run, home**: the brake run into the station.
 *
 * `cityTrack.test.ts` holds it to the beats and to its clearances (the towers, the hero tower, the train line, itself).
 */
import type { RideBeat, RideMechanic, RideV2Spec, SpeedZone, SplineTrackParams } from '@/types/level'
import { createSplineCurve } from '@/track/curves/SplineCurve'
import { RideBuilder, type MarkerKind } from '@/track/elements/rideBuilder'
import { airtimeHill, bankedTurn, helix } from '@/track/elements/elements'
import { headChopper } from '@/track/elements/headChopper'
import { straightTo, trimUnrolledUps } from '@/track/elements/climbing'
import { placeMechanics, station } from '@/track/elements/mechanicElements'
import { getTrackDimensions } from '@/track/trackDimensions'
import { RIDE_V2_DEFAULTS } from '@/track/rideV2'
import { ELEVATED_LINE, LANDMARK_SITE } from './config'

/** Level 7's structure scale. */
const SCALAR = 20
const EYE = getTrackDimensions({ scalar: SCALAR }).eyeHeight
/** Units between the turtle's control points. */
const SPACING = 60
const DEG = Math.PI / 180

/** Headings (`RideBuilder`: +z at 0, +x at a quarter turn). */
const EAST = Math.PI / 2
/** A left turn (positive) or a right one, a quarter round on a street corner. */
const LEFT = Math.PI / 2
const RIGHT = -Math.PI / 2

/** Speeds, world units a second. */
const SPEED = { launch: 230, lift: 95, crest: 75, street: 170, helix: 200, run: 115, brake: 60 } as const

/** A street corner's radius: a quarter turn from one street's centre line onto the cross street's. */
const CORNER = 120
const STATION = { x: -840, y: 12, z: 600 } as const
/** The lift: north up the street beside the lift tower, to the crest. */
const LIFT = { x: -120, toZ: -360, topY: 300 } as const
/**
 * The first drop: east along the top to `edge`, then down the street between the drop towers to the train line's height at
 * `grade`, pitched over the edge slowly (`top`) and out at the bottom on a wider radius, the car being fast by then.
 */
const DROP = { edge: 120, grade: 62 * DEG, top: 35, bottom: 100 } as const
/** The street ridden under the elevated line (north along x = 600). */
const CROSSING = { x: 600, toZ: -720 } as const
const RAIL = headChopper(
  {
    min: { x: ELEVATED_LINE.from, y: ELEVATED_LINE.under, z: ELEVATED_LINE.z - ELEVATED_LINE.width / 2 },
    max: { x: ELEVATED_LINE.to, y: ELEVATED_LINE.under + ELEVATED_LINE.deck, z: ELEVATED_LINE.z + ELEVATED_LINE.width / 2 },
  },
  { x: 0, y: -1, z: 0 },
  { eyeHeight: EYE, clearance: 2, gap: EYE },
).rail
/** The airtime crest, west along the north side. */
const CREST = { fromX: 240, rise: 40, crestRadius: 160, angle: 28 * DEG } as const
/** The helix: a climbing turn and a quarter round the hero tower, entered on its north side heading west. */
const HELIX = { radius: 240, turns: 1.25, climb: 110, bank: 30 * DEG } as const
/** The face-off: south down the west side, a dogleg east and back west (the streets at these lines), then home. */
const RUN = { south: -120, east: -360, back: 120, home: -1080, y: 24 } as const

/** The storyboard's beats: the second the car reaches the `nth` element of a kind, its start or (`middle`) its middle. */
const BEATS: { kind: MarkerKind; second: number; nth?: number; at?: 'middle' | 'end' }[] = [
  { kind: 'liftHill', second: 5 },
  { kind: 'airtimeHill', second: 26, at: 'middle' },
  { kind: 'helix', second: 40, at: 'end' },
]

export interface CityRide {
  points: RideBuilder['points']
  markers: RideBuilder['markers']
  mechanics: RideMechanic[]
  zones: { kind: SpeedZone['kind']; from: number; to: number; speed: number; accel?: number }[]
}

export function buildCityRide(): CityRide {
  const b = new RideBuilder({ ...STATION, heading: EAST, eyeHeight: EYE, spacing: SPACING })
  const mechanics: RideMechanic[] = []
  const zones: CityRide['zones'] = []
  const zone = (kind: SpeedZone['kind'], speed: number, build: () => void, accel?: number) => {
    const from = b.points.length - 1
    build()
    zones.push({ kind, from, to: b.points.length - 1, speed, ...(accel ? { accel } : {}) })
  }
  const y = () => b.position.y
  const corner = (angle: number, rise = 0, radius = CORNER, bank = 25 * DEG) => bankedTurn(b, { angle, radius, rise, bank, ease: 3 * EYE })

  mechanics.push(station(b, { speed: SPEED.launch }))
  b.mark('straight', () => straightTo(b, 'x', LIFT.x - CORNER))
  corner(LEFT)
  zone('lift', SPEED.lift, () => b.mark('liftHill', () => straightTo(b, 'z', LIFT.toZ + CORNER, { rise: LIFT.topY - y(), ease: 8 * EYE })))
  zone('lift', SPEED.crest, () => corner(RIGHT, 0, CORNER, 15 * DEG))
  b.mark('straight', () => {
    straightTo(b, 'x', DROP.edge)
    const fall = y() - RAIL.y - (DROP.top + DROP.bottom) * (1 - Math.cos(DROP.grade))
    b.pitch(-DROP.grade, DROP.top)
    b.straight(fall / Math.sin(DROP.grade))
    b.pitch(DROP.grade, DROP.bottom)
  })
  zone('brake', SPEED.street, () => {
    b.mark('straight', () => straightTo(b, 'x', CROSSING.x - CORNER))
    corner(LEFT)
    b.mark('straight', () => straightTo(b, 'z', ELEVATED_LINE.z + 4 * EYE))
    b.mark('headChopper', () => straightTo(b, 'z', ELEVATED_LINE.z - 4 * EYE))
  })
  zone('lift', SPEED.street, () => {
    b.mark('straight', () => straightTo(b, 'z', CROSSING.toZ))
    corner(LEFT)
    b.mark('straight', () => straightTo(b, 'x', CREST.fromX))
  })
  airtimeHill(b, CREST)
  zone('lift', SPEED.helix, () => {
    b.mark('straight', () => straightTo(b, 'x', LANDMARK_SITE.x))
    helix(b, { radius: HELIX.radius, turns: HELIX.turns, drop: -HELIX.climb, bank: HELIX.bank, hand: 1 })
  })
  zone('brake', SPEED.run, () => {
    b.mark('straight', () => straightTo(b, 'z', RUN.south - CORNER, { rise: RUN.y - y(), ease: 10 * EYE }))
    corner(LEFT)
    b.mark('straight', () => straightTo(b, 'x', RUN.east - CORNER))
    corner(RIGHT)
    b.mark('straight', () => straightTo(b, 'z', RUN.back - CORNER))
    corner(RIGHT)
    b.mark('straight', () => straightTo(b, 'x', RUN.home + CORNER))
  })
  zone('brake', SPEED.brake, () => {
    corner(LEFT)
    b.mark('straight', () => straightTo(b, 'z', STATION.z - CORNER))
    corner(LEFT)
  })
  b.mark('straight', () => straightTo(b, 'x', STATION.x - SPACING, { rise: STATION.y - y(), ease: 2 * EYE }))
  return { points: b.points, markers: b.markers, mechanics, zones }
}

/** The ride's v2 spec, mechanics and the storyboard's beats placed on the built track. */
export function buildCityTrack(): SplineTrackParams {
  const ride = buildCityRide()
  const points = trimUnrolledUps(ride.points)
  const curve = createSplineCurve(points)
  const share = (i: number) => curve.knotT(i)
  const zones: SpeedZone[] = ride.zones.map((z) => ({ ...z, from: share(z.from), to: share(z.to) }))
  const beats: RideBeat[] = BEATS.map(({ kind, second, nth = 0, at }) => {
    const m = ride.markers.filter((k) => k.kind === kind)[nth]
    if (!m) throw new Error(`city ride: no ${kind} for its beat`)
    return { at: share(at === 'end' ? m.to : at === 'middle' ? Math.round((m.from + m.to) / 2) : m.from), second }
  })
  const rideV2: RideV2Spec = { zones, beats, drag: RIDE_V2_DEFAULTS.drag / 2 }
  return {
    curve: 'spline',
    controlPoints: points,
    scalar: SCALAR,
    ride: 'v2',
    rideV2,
    mechanics: placeMechanics(curve, ride.mechanics),
    color1: 0xff3fb4,
    color2: 0x2ee6ff,
    glow: 0.6,
  }
}

export const CITY_TRACK: SplineTrackParams = buildCityTrack()
