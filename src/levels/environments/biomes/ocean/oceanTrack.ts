/**
 * Level 3's ride (#865, from the ride kit's storyboard, `docs/RIDE-KIT.md`), pure: a v2 ride (gravity, speed zones,
 * beats) built by the ride elements' turtle (`src/track/elements/`) round the lagoon, in world units (the sea is y = 0).
 * The storyboard, with the second each beat lands (`BEATS`):
 *
 * - **0 s, the station** on the lagoon's north side: GO launches it east.
 * - **3–12 s, the lift hill**: a chain straight east along the north side, the lagoon and the islands opening up.
 * - **13 s, the first drop**: round onto the east side at the top and straight down at the sea.
 * - **15 s, the splashdown**: the drop's foot skims the surface (spray, a kick, the splash) and dives on into…
 * - **15–25 s, the glass tunnel**: under the water round the south-east corner and west along the south side, the
 *   jellyfish bobbing on the surface overhead.
 * - **26–31 s, the camelbacks**: up out of the sea into two airtime hills west along the south side.
 * - **33 s, the sea arch**: round the south-west corner and north through a rock arch in a slow corkscrew (the near
 *   miss: the arch's crown a few metres over the rider's head as they roll under it).
 * - **35–40 s, the second lift** east across the lagoon, cresting as the Kraken rises (40 s).
 * - **40–55 s, the finale**: a slow helix down over the lagoon's middle for the boss fight, the Kraken in front.
 * - **55–60 s, the brake run** north and west round to the station's hairpin: home.
 *
 * `oceanTrack.test.ts` holds it to the beats and to its clearances (the seabed, the arch, the water over the tunnel).
 */
import type { RideBeat, RideMechanic, RideV2Spec, SpeedZone, SplineTrackParams, TunnelSpec } from '@/types/level'
import { createSplineCurve } from '@/track/curves/SplineCurve'
import { RideBuilder, type MarkerKind } from '@/track/elements/rideBuilder'
import { airtimeHill, bankedTurn, corkscrew, helix } from '@/track/elements/elements'
import { straightTo, trimUnrolledUps } from '@/track/elements/climbing'
import { placeMechanics, station } from '@/track/elements/mechanicElements'
import { getTrackDimensions } from '@/track/trackDimensions'
import { buildArcTable } from '@/track/arcLength'
import { RIDE_V2_DEFAULTS } from '@/track/rideV2'

/** Level 3's structure scale. */
const SCALAR = 20
const EYE = getTrackDimensions({ scalar: SCALAR }).eyeHeight
/** Units between the turtle's control points. */
const SPACING = 60
const DEG = Math.PI / 180

/** Headings (`RideBuilder`: +z at 0, a positive turn to the left). */
const EAST = Math.PI / 2

/** Speeds, world units a second. */
const SPEED = { launch: 130, lift: 70, crest: 45, tunnel: 80, relaunch: 220, cork: 90, lift2: 75, helix: 90, home: 90, brake: 50 } as const

const STATION = { x: -480, y: 12, z: 350 } as const
const LIFT = { from: -250, to: 200, topY: 175 } as const
const EAST_X = 330
/** The drop's foot skims the sea (rails this far over it): the splashdown. */
const DROP = { toZ: 30, footY: 3, ease: 280 } as const
/** Under the water: the rails' depth, the dive's run, the corner and the climb back out to `outX`. */
const DEEP = { y: -21, diveZ: -300, cornerZ: -480, toX: 150, outX: -20, outY: 14 } as const
const CAMEL = { toX: -480, rise: 60, crest: 150, angle: 30 * DEG } as const
const WEST_X = -630
/** The corkscrew north through the sea arch: its rails' height and length (one slow roll). */
const CORK = { y: 12, fromZ: -330, length: 360 } as const
/** The inner loop's line, east from the arch's corner (`CORNER` its radius) on the second lift. */
const INNER_Z = 150
const CORNER = 110
const LIFT2 = { from: -450, to: -150, topY: 120 } as const
const FINALE = { helixFrom: -60, helixRadius: 80, helixTurns: 1.5, helixDrop: 80, westTo: -120, northX: -200, returnZ: 250, brakeFrom: -380 } as const
const HOME_X = STATION.x - 90

/** The storyboard's beats: the second the car reaches the `nth` element of a kind, its start or (`middle`) its middle. */
const BEATS: { kind: MarkerKind; second: number; nth?: number; at?: 'middle' | 'end' }[] = [
  { kind: 'liftHill', second: 3 },
  { kind: 'airtimeHill', second: 25, at: 'middle' },
  { kind: 'corkscrew', second: 31, at: 'middle' },
  { kind: 'liftHill', nth: 1, second: 40, at: 'end' },
]

export interface OceanRide {
  points: RideBuilder['points']
  markers: RideBuilder['markers']
  mechanics: RideMechanic[]
  zones: { kind: SpeedZone['kind']; from: number; to: number; speed: number; accel?: number }[]
  /** The glass tunnel under the sea, by control point index. */
  tunnel: { from: number; to: number }
  /** The drop's foot, where it hits the water, by control point index. */
  splash: number
}

export function buildOceanRide(): OceanRide {
  const b = new RideBuilder({ ...STATION, heading: EAST, eyeHeight: EYE, spacing: SPACING })
  const mechanics: RideMechanic[] = []
  const zones: OceanRide['zones'] = []
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
  b.mark('straight', () => straightTo(b, 'z', DROP.toZ, { rise: DROP.footY - y(), ease: DROP.ease }))
  const splash = b.points.length - 1
  const tunnelFrom = splash
  zone('brake', SPEED.tunnel, () => {
    b.mark('straight', () => straightTo(b, 'z', DEEP.diveZ, { rise: DEEP.y - y(), ease: 12 * EYE }))
    turn(Math.PI / 2, DEEP.diveZ - DEEP.cornerZ)
    b.mark('straight', () => straightTo(b, 'x', DEEP.toX))
  })
  zone('launch', SPEED.relaunch, () => b.mark('straight', () => straightTo(b, 'x', DEEP.outX, { rise: DEEP.outY - y(), ease: 4 * EYE })))
  const tunnelTo = b.points.length - 1
  airtimeHill(b, { rise: CAMEL.rise, crestRadius: CAMEL.crest, angle: CAMEL.angle })
  b.mark('straight', () => straightTo(b, 'x', CAMEL.toX))
  turn(Math.PI / 2, CAMEL.toX - WEST_X, CORK.y - y())
  b.mark('straight', () => straightTo(b, 'z', CORK.fromZ))
  zone('brake', SPEED.cork, () => corkscrew(b, { length: CORK.length }))
  b.mark('straight', () => straightTo(b, 'z', INNER_Z - CORNER))
  turn(Math.PI / 2, CORNER)
  b.mark('straight', () => straightTo(b, 'x', LIFT2.from))
  zone('lift', SPEED.lift2, () => b.mark('liftHill', () => straightTo(b, 'x', LIFT2.to, { rise: LIFT2.topY - y(), ease: 8 * EYE })))
  b.mark('straight', () => straightTo(b, 'x', FINALE.helixFrom))
  zone('brake', SPEED.helix, () =>
    helix(b, { radius: FINALE.helixRadius, turns: FINALE.helixTurns, drop: FINALE.helixDrop, bank: 30 * DEG }),
  )
  b.mark('straight', () => straightTo(b, 'x', FINALE.westTo))
  turn(Math.PI / 2, FINALE.westTo - FINALE.northX)
  zone('brake', SPEED.home, () => {
    b.mark('straight', () => straightTo(b, 'z', INNER_Z, { rise: STATION.y + 15 - y(), ease: 4 * EYE }))
    turn(-Math.PI / 2, FINALE.returnZ - INNER_Z)
    b.mark('straight', () => straightTo(b, 'x', FINALE.brakeFrom, { rise: STATION.y - y(), ease: 4 * EYE }))
  })
  zone('brake', SPEED.brake, () => {
    b.mark('straight', () => straightTo(b, 'x', HOME_X))
    turn(Math.PI, (STATION.z - FINALE.returnZ) / 2)
  })
  b.mark('straight', () => straightTo(b, 'x', STATION.x - SPACING))
  return {
    points: b.points,
    markers: b.markers,
    mechanics,
    zones,
    tunnel: { from: tunnelFrom, to: tunnelTo },
    splash,
  }
}

/** The ride's v2 spec, mechanics, glass tunnel and the storyboard's beats placed on the built track. */
export function buildOceanTrack(): SplineTrackParams {
  const ride = buildOceanRide()
  const points = trimUnrolledUps(ride.points)
  const curve = createSplineCurve(points)
  const share = (i: number) => curve.knotT(i)
  const zones: SpeedZone[] = ride.zones.map((z) => ({ ...z, from: share(z.from), to: share(z.to) }))
  const beats: RideBeat[] = BEATS.map(({ kind, second, nth = 0, at }) => {
    const m = ride.markers.filter((k) => k.kind === kind)[nth]
    if (!m) throw new Error(`ocean ride: no ${kind} for its beat`)
    return { at: share(at === 'end' ? m.to : at === 'middle' ? Math.round((m.from + m.to) / 2) : m.from), second }
  })
  const rideV2: RideV2Spec = { zones, beats, drag: RIDE_V2_DEFAULTS.drag / 2 }
  const length = buildArcTable(curve).length
  const tunnels: TunnelSpec[] = [
    { from: share(ride.tunnel.from), length: (share(ride.tunnel.to) - share(ride.tunnel.from)) * length, glass: true },
  ]
  return {
    curve: 'spline',
    controlPoints: points,
    scalar: SCALAR,
    ride: 'v2',
    rideV2,
    mechanics: placeMechanics(curve, ride.mechanics),
    tunnels,
    color1: 0x416fa0,
    color2: 0x31ffd5,
  }
}

export const OCEAN_TRACK: SplineTrackParams = buildOceanTrack()
