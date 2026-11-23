/**
 * Level 1's ride (#863, from the ride kit's storyboard, `docs/RIDE-KIT.md`), pure: a v2 ride (gravity, speed zones,
 * beats) built by the ride elements' turtle (`src/track/elements/`) round the Theme Park, in world units. The storyboard,
 * with the second each beat lands (`BEATS`):
 *
 * - **0 s, the station** by the midway's west end: GO launches it east.
 * - **3–12 s, the lift hill**: a chain straight east over the park, the midway and the rides opening up below as it
 *   climbs to the top (~180 units).
 * - **13 s, the first drop**: round onto the east side at the top and down past the big Ferris wheel's rim into the
 *   tunnel under the midway.
 * - **17–25 s, the camelbacks**: two airtime hills west along the park's south side, the balloons on the crests.
 * - **28 s, the Ferris wheel**: up round the south-west corner and north past the small wheel, its gondolas sweeping by
 *   a few metres off the rider's shoulder (the near miss).
 * - **34–40 s, the second lift** east along the park's north edge, cresting as the Golden Blimp arrives (40 s).
 * - **40–55 s, the finale**: a long, slow curve round the north-east and back west over the park, the blimp in front.
 * - **55–60 s, the brake run** into the station's hairpin: home.
 *
 * `parkTrack.test.ts` holds it to the beats and to its clearances (the ground, the rides, its own other passes).
 */
import type { RideBeat, RideMechanic, RideV2Spec, SpeedZone, SplineTrackParams, TunnelSpec } from '@/types/level'
import { createSplineCurve } from '@/track/curves/SplineCurve'
import { RideBuilder, type MarkerKind } from '@/track/elements/rideBuilder'
import { airtimeHill, bankedTurn, helix } from '@/track/elements/elements'
import { straightTo, trimUnrolledUps } from '@/track/elements/climbing'
import { placeMechanics, station } from '@/track/elements/mechanicElements'
import { getTrackDimensions } from '@/track/trackDimensions'
import { buildArcTable } from '@/track/arcLength'
import { RIDE_V2_DEFAULTS } from '@/track/rideV2'

/** Level 1's structure scale. */
const SCALAR = 20
const EYE = getTrackDimensions({ scalar: SCALAR }).eyeHeight
/** Units between the turtle's control points. */
const SPACING = 60
const DEG = Math.PI / 180

/** Headings (`RideBuilder`: +z at 0, a positive turn to the left). */
const EAST = Math.PI / 2

/** Speeds, world units a second. */
const SPEED = { launch: 140, lift: 60, crest: 45, lift2: 55, helix: 110, brake: 40 } as const

const STATION = { x: -350, y: 12, z: 150 } as const
const LIFT = { from: -150, to: 310, topY: 200 } as const
/** The east side's line: just off the big wheel's rim (its west edge is 430). */
const EAST_X = 400
const DROP = { toZ: -220, bottomY: 16, ease: 152 } as const
/** The tunnel: from the drop's foot, round the south-east corner and on along the south side to `toX`. */
const TUNNEL = { cornerZ: -450, toX: 180 } as const
const CAMEL = { z: -650, toX: -560, rise: 50, crest: 150, angle: 30 * DEG } as const
const WEST_X = -700
const WHEEL_Y = 64
/** The small Ferris wheel's plane (`parkSpec.ts`), and how far either side of it the near miss is marked. */
const WHEEL = { z: 130, pass: 60 } as const
const NORTH = { z: 520, liftFrom: -450, liftTo: 0, topY: 150 } as const
const RETURN_Z = 250
const FINALE = { cruiseTo: 150, helixDrop: 90, dipTo: 0, dipY: 30, dipEase: 120, hill: 40, brakeFrom: -250 } as const
const HOME_X = -440

/** The storyboard's beats: the second the car reaches the `nth` element of a kind, its start or (`middle`) its middle. */
const BEATS: { kind: MarkerKind; second: number; nth?: number; at?: 'middle' | 'end' }[] = [
  { kind: 'liftHill', second: 3 },
  { kind: 'airtimeHill', second: 17, at: 'middle' },
  { kind: 'headChopper', second: 28, at: 'middle' },
  { kind: 'liftHill', nth: 1, second: 40, at: 'end' },
]

export interface ParkRide {
  points: RideBuilder['points']
  markers: RideBuilder['markers']
  mechanics: RideMechanic[]
  zones: { kind: SpeedZone['kind']; from: number; to: number; speed: number; accel?: number }[]
  /** The tunnel under the midway, by control point index. */
  tunnel: { from: number; to: number }
}

export function buildParkRide(): ParkRide {
  const b = new RideBuilder({ ...STATION, heading: EAST, eyeHeight: EYE, spacing: SPACING })
  const mechanics: RideMechanic[] = []
  const zones: ParkRide['zones'] = []
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
  zone('lift', SPEED.crest, () => turn(Math.PI / 2, EAST_X - LIFT.to, 0, 15 * DEG))
  b.mark('straight', () => straightTo(b, 'z', DROP.toZ, { rise: DROP.bottomY - y(), ease: DROP.ease }))
  const tunnelFrom = b.points.length - 1
  b.mark('straight', () => straightTo(b, 'z', TUNNEL.cornerZ))
  turn(Math.PI / 2, TUNNEL.cornerZ - CAMEL.z)
  b.mark('straight', () => straightTo(b, 'x', TUNNEL.toX))
  const tunnelTo = b.points.length - 1
  for (let i = 0; i < 2; i++) airtimeHill(b, { rise: CAMEL.rise, crestRadius: CAMEL.crest, angle: CAMEL.angle })
  b.mark('straight', () => straightTo(b, 'x', CAMEL.toX))
  turn(Math.PI / 2, CAMEL.toX - WEST_X, WHEEL_Y - y())
  b.mark('straight', () => straightTo(b, 'z', WHEEL.z - WHEEL.pass))
  b.mark('headChopper', () => straightTo(b, 'z', WHEEL.z + WHEEL.pass))
  b.mark('straight', () => straightTo(b, 'z', NORTH.z - 150))
  turn(Math.PI / 2, 150)
  b.mark('straight', () => straightTo(b, 'x', NORTH.liftFrom))
  zone('lift', SPEED.lift2, () => b.mark('liftHill', () => straightTo(b, 'x', NORTH.liftTo, { rise: NORTH.topY - y(), ease: 8 * EYE })))
  b.mark('straight', () => straightTo(b, 'x', FINALE.cruiseTo))
  zone('brake', SPEED.helix, () => helix(b, { radius: (NORTH.z - RETURN_Z) / 2, turns: 1.5, drop: FINALE.helixDrop, bank: 30 * DEG }))
  b.mark('straight', () => straightTo(b, 'x', FINALE.dipTo, { rise: FINALE.dipY - y(), ease: FINALE.dipEase }))
  airtimeHill(b, { rise: FINALE.hill, crestRadius: CAMEL.crest, angle: CAMEL.angle })
  b.mark('straight', () => straightTo(b, 'x', FINALE.brakeFrom))
  zone('brake', SPEED.brake, () => {
    b.mark('straight', () => straightTo(b, 'x', HOME_X, { rise: STATION.y + 20 - y(), ease: 4 * EYE }))
    turn(-Math.PI, (RETURN_Z - STATION.z) / 2, STATION.y - y())
  })
  b.mark('straight', () => straightTo(b, 'x', STATION.x - SPACING))
  return { points: b.points, markers: b.markers, mechanics, zones, tunnel: { from: tunnelFrom, to: tunnelTo } }
}

/** The ride's v2 spec, mechanics, tunnel and the storyboard's beats placed on the built track. */
export function buildParkTrack(): SplineTrackParams {
  const ride = buildParkRide()
  const points = trimUnrolledUps(ride.points)
  const curve = createSplineCurve(points)
  const share = (i: number) => curve.knotT(i)
  const zones: SpeedZone[] = ride.zones.map((z) => ({ ...z, from: share(z.from), to: share(z.to) }))
  const beats: RideBeat[] = BEATS.map(({ kind, second, nth = 0, at }) => {
    const m = ride.markers.filter((k) => k.kind === kind)[nth]
    if (!m) throw new Error(`park ride: no ${kind} for its beat`)
    return { at: share(at === 'end' ? m.to : at === 'middle' ? Math.round((m.from + m.to) / 2) : m.from), second }
  })
  const rideV2: RideV2Spec = { zones, beats, drag: RIDE_V2_DEFAULTS.drag / 2 }
  const length = buildArcTable(curve).length
  const tunnels: TunnelSpec[] = [{ from: share(ride.tunnel.from), length: (share(ride.tunnel.to) - share(ride.tunnel.from)) * length }]
  return {
    curve: 'spline',
    controlPoints: points,
    scalar: SCALAR,
    ride: 'v2',
    rideV2,
    mechanics: placeMechanics(curve, ride.mechanics),
    tunnels,
    color1: 0xf3ece0,
    color2: 0xffff00,
  }
}

export const PARK_TRACK: SplineTrackParams = buildParkTrack()
