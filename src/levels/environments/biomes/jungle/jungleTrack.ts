/**
 * Level 8's ride (#1009, from the ride kit's storyboard, `docs/RIDE-KIT.md`), pure: a v2 ride (gravity, speed zones, beats)
 * built by the ride elements' turtle (`src/track/elements/`) through Jungle Ruins' valleys, in world units, north being -z.
 * The temple stands on its terrace far to the north-east (`TEMPLE`), the waterfall right of it (`FALLS`). The storyboard,
 * with the second each beat lands (`BEATS`):
 *
 * - **0 s, the station** south of the clearing: GO launches it west under the canopy.
 * - **5 s, the lift hill**: round onto the temple and up a chain on the clearing's west side, straight at it, over the
 *   treetops.
 * - **~15 s, the first drop**: over a level crest and down (65°) with the temple dead ahead and the waterfall right of
 *   it, into the valley the ride has carved in the hills.
 * - **~17–24 s, the valley run**: low towards the temple's foot through the mist, then round east under it.
 * - **26 s, the airtime crest** in front of the waterfall, on the valley floor south of it.
 * - **~29–40 s, the helix**: round south down the east valley, then a climbing turn and a quarter out of it as the boss
 *   arrives (40 s).
 * - **40–60 s, the finale**: a slow run west over the jungle, one long straight, the boss hovering ahead for the fight.
 * - **After the run, home**: round into the station.
 *
 * `jungleTrack.test.ts` holds it to the beats, the drop's framing and its clearances (the temple, the falls, itself).
 */
import type { RideBeat, RideMechanic, RideV2Spec, SpeedZone, SplineTrackParams } from '@/types/level'
import { createSplineCurve } from '@/track/curves/SplineCurve'
import { RideBuilder, type MarkerKind } from '@/track/elements/rideBuilder'
import { airtimeHill, bankedTurn, helix } from '@/track/elements/elements'
import { climbingStraight, straightTo, trimUnrolledUps } from '@/track/elements/climbing'
import { placeMechanics, station } from '@/track/elements/mechanicElements'
import { getTrackDimensions } from '@/track/trackDimensions'
import { RIDE_V2_DEFAULTS } from '@/track/rideV2'
import { FALLS, TEMPLE } from './config'

/** Level 8's structure scale. */
const SCALAR = 20
const EYE = getTrackDimensions({ scalar: SCALAR }).eyeHeight
/** Units between the turtle's control points. */
const SPACING = 60
const DEG = Math.PI / 180

/** Headings (`RideBuilder`: +z at 0, +x at a quarter turn). */
const WEST = -Math.PI / 2
const EAST = Math.PI / 2
const LEFT = Math.PI / 2
const RIGHT = -Math.PI / 2

/** Speeds, world units a second. */
const SPEED = { launch: 200, lift: 110, crest: 70, valley: 170, helix: 190, run: 45, brake: 40 } as const

const CORNER = 150
const STATION = { x: -100, y: 12, z: 650 } as const
/**
 * Where the lift and the drop aim: the temple, a little towards the waterfall on its right so that both are in front of the
 * drop (`jungleLayout.test.ts`).
 */
const AIM = { x: TEMPLE.x + 0.3 * (FALLS.x - TEMPLE.x), z: TEMPLE.z + 0.3 * (FALLS.z - TEMPLE.z) } as const
/** The lift: straight at `AIM` up the clearing's west side, to the crest. */
const LIFT = { run: 800, topY: 320 } as const
/** The level crest the car tips over the drop from, slowly. */
const CREST_RUN = 2 * SPACING
/** The first drop: pitched over the edge slowly (`top`), out at the bottom on a wider radius, to the valley floor. */
const DROP = { grade: 65 * DEG, top: 40, bottom: 120, floor: 40 } as const
/** The valley run: on towards the temple until this far short of it (its terrace is 470 across, the slope 320 more). */
const VALLEY = { shortOfTemple: 1200 } as const
/** East along the valley under the temple and the waterfall, to the east valley's line. */
const EAST_RUN = { toX: 1750 } as const
const CREST = { rise: 35, crestRadius: 160, angle: 26 * DEG } as const
/** South down the east valley to the helix. */
const SOUTH_RUN = { toZ: -150 } as const
const HELIX = { radius: 220, turns: 1.25, climb: 110, bank: 30 * DEG } as const
/** The finale's height, eased into along its straight. */
const RUN = { y: 60 } as const

/** The storyboard's beats: the second the car reaches the `nth` element of a kind, its start or (`middle`) its middle. */
const BEATS: { kind: MarkerKind; second: number; nth?: number; at?: 'middle' | 'end' }[] = [
  { kind: 'liftHill', second: 5 },
  { kind: 'airtimeHill', second: 26, at: 'middle' },
  { kind: 'helix', second: 40, at: 'end' },
]

export interface JungleRide {
  points: RideBuilder['points']
  markers: RideBuilder['markers']
  mechanics: RideMechanic[]
  zones: { kind: SpeedZone['kind']; from: number; to: number; speed: number; accel?: number }[]
}

export function buildJungleRide(): JungleRide {
  const b = new RideBuilder({ ...STATION, heading: WEST, eyeHeight: EYE, spacing: SPACING })
  const mechanics: RideMechanic[] = []
  const zones: JungleRide['zones'] = []
  const zone = (kind: SpeedZone['kind'], speed: number, build: () => void, accel?: number) => {
    const from = b.points.length - 1
    build()
    zones.push({ kind, from, to: b.points.length - 1, speed, ...(accel ? { accel } : {}) })
  }
  const y = () => b.position.y
  const corner = (angle: number, { rise = 0, radius = CORNER, bank = 25 * DEG } = {}) =>
    bankedTurn(b, { angle, radius, rise, bank, ease: 3 * EYE })
  /** The turn (positive left) from the car's heading onto `want`. */
  const onto = (want: number) => {
    const now = Math.atan2(b.forward.x, b.forward.z)
    return Math.atan2(Math.sin(want - now), Math.cos(want - now))
  }
  const towards = (x: number, z: number) => onto(Math.atan2(x - b.position.x, z - b.position.z))

  mechanics.push(station(b, { speed: SPEED.launch }))
  b.mark('straight', () => straightTo(b, 'x', STATION.x - 20 * EYE - 2 * SPACING))
  corner(towards(AIM.x, AIM.z))
  zone('lift', SPEED.lift, () => b.mark('liftHill', () => climbingStraight(b, LIFT.run, { rise: LIFT.topY - y(), ease: 8 * EYE })))
  // Over the top: round onto the temple, slowly, then over the edge with it dead ahead
  zone('lift', SPEED.crest, () => b.mark('straight', () => b.straight(CREST_RUN)))
  b.mark('straight', () => {
    const fall = y() - DROP.floor - (DROP.top + DROP.bottom) * (1 - Math.cos(DROP.grade))
    b.pitch(-DROP.grade, DROP.top)
    b.straight(fall / Math.sin(DROP.grade))
    b.pitch(DROP.grade, DROP.bottom)
  })
  zone('brake', SPEED.valley, () => {
    b.mark('straight', () => b.straight(Math.hypot(TEMPLE.x - b.position.x, TEMPLE.z - b.position.z) - VALLEY.shortOfTemple))
    corner(onto(EAST), { radius: 2 * CORNER })
  })
  zone('lift', SPEED.valley, () => b.mark('straight', () => straightTo(b, 'x', EAST_RUN.toX - 2 * CORNER - 350)))
  airtimeHill(b, CREST)
  zone('lift', SPEED.valley, () => {
    b.mark('straight', () => straightTo(b, 'x', EAST_RUN.toX - CORNER))
    corner(RIGHT)
    b.mark('straight', () => straightTo(b, 'z', SOUTH_RUN.toZ))
  })
  zone('lift', SPEED.helix, () => helix(b, { radius: HELIX.radius, turns: HELIX.turns, drop: -HELIX.climb, bank: HELIX.bank, hand: -1 }))
  const home = STATION.x + 2 * SPACING
  zone('brake', SPEED.run, () => b.mark('straight', () => straightTo(b, 'x', home + 2 * CORNER, { rise: RUN.y - y(), ease: 10 * EYE })))
  zone('brake', SPEED.brake, () => corner(LEFT))
  b.mark('straight', () => straightTo(b, 'z', STATION.z - CORNER, { rise: STATION.y - y(), ease: 4 * EYE }))
  corner(RIGHT)
  b.mark('straight', () => straightTo(b, 'x', STATION.x + SPACING))
  return { points: b.points, markers: b.markers, mechanics, zones }
}

/** The ride's v2 spec, mechanics and the storyboard's beats placed on the built track. */
export function buildJungleTrack(): SplineTrackParams {
  const ride = buildJungleRide()
  const points = trimUnrolledUps(ride.points)
  const curve = createSplineCurve(points)
  const share = (i: number) => curve.knotT(i)
  const zones: SpeedZone[] = ride.zones.map((z) => ({ ...z, from: share(z.from), to: share(z.to) }))
  const beats: RideBeat[] = BEATS.map(({ kind, second, nth = 0, at }) => {
    const m = ride.markers.filter((k) => k.kind === kind)[nth]
    if (!m) throw new Error(`jungle ride: no ${kind} for its beat`)
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
    color1: 0xd8c9a0,
    color2: 0x3f8a4a,
  }
}

export const JUNGLE_TRACK: SplineTrackParams = buildJungleTrack()
