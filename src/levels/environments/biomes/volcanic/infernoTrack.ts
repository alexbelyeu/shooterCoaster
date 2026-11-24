/**
 * Level 5's ride (#867, from the ride kit's storyboard, `docs/RIDE-KIT.md`), pure: a v2 ride built by the ride elements'
 * turtle (`src/track/elements/`) round the Inferno, in world units, the volcano (`volcanoGeometry.ts`) north-east of the
 * plain. The storyboard, with the second each beat lands (`BEATS`):
 *
 * - **0 s, the station** at the mouth of a lava tube west of the volcano: GO launches it east through the glowing tube.
 * - **4–16 s, the lift hill**: a chain east up out of the tube's channel, straight at the volcano's flank.
 * - **16 s, into the volcano**: through a hole in the flank at the lift's top, onto the drop tower inside the cone.
 * - **18 s, the drop tower**: the car stops, then falls upright with its piece of track down the hollow cone, the crater
 *   glowing far overhead (the first drop).
 * - **22 s, out of the volcano**: round south-west at its floor and out through a hole in the flank a few metres round
 *   the rider (the near miss).
 * - **26–31 s, the camelbacks**: two airtime hills west across the plain, the targets on the crests.
 * - **36–39 s, the turntable**: round north, onto a turntable that turns the car to face back south, as the Magma Titan
 *   rises behind it (40 s).
 * - **40–57 s, backwards**: north, slowly, facing the Titan for his whole fight.
 * - **After the run, home**: a turntable turns the car forward again, round east into the station.
 *
 * `infernoTrack.test.ts` holds it to the beats, the drop's fall inside the cone and the holes it rides through.
 */
import type { RideBeat, RideMechanic, RideV2Spec, SpeedZone, SplineTrackParams, TunnelSpec } from '@/types/level'
import { createSplineCurve } from '@/track/curves/SplineCurve'
import { RideBuilder, type MarkerKind } from '@/track/elements/rideBuilder'
import { airtimeHill, bankedTurn } from '@/track/elements/elements'
import { climbingStraight, straightTo, trimUnrolledUps } from '@/track/elements/climbing'
import { backwards, dropTrack, placeMechanics, station } from '@/track/elements/mechanicElements'
import { getTrackDimensions } from '@/track/trackDimensions'
import { buildArcTable } from '@/track/arcLength'
import { STOP_APPROACH } from '@/track/mechanics'
import { getTunnelDims } from '@/track/setPieces'
import { RIDE_V2_DEFAULTS } from '@/track/rideV2'
import { VOLCANO_SITE, coneRadius } from '../../volcanoGeometry'

/** Level 5's structure scale. */
const SCALAR = 40
const EYE = getTrackDimensions({ scalar: SCALAR }).eyeHeight
/** Units between the turtle's control points. */
const SPACING = 80
const DEG = Math.PI / 180

/** Headings (`RideBuilder`: +z at 0, a positive turn to the left): east is +x, north -z. */
const EAST = Math.PI / 2

/** Speeds, world units a second. */
const SPEED = { launch: 200, lift: 100, fall: 230, camel: 300, turntable: 60, backwards: 80, brake: 60 } as const

/** The volcano's base height (the ground at its site: `createHeightFunction('volcanic')` there, which the track doesn't reach). */
export const VOLCANO_BASE_Y = 76

const STATION = { x: -500, y: 40, z: VOLCANO_SITE.z } as const
/** The lava tube: from the station's mouth, round the car waiting for GO, to `length` units past the station. */
const TUBE = { length: 420 } as const
/** The lift: from `fromX` up to the hole in the flank, `holeUp` over the volcano's base. */
const LIFT = { fromX: 150, holeUp: 450 } as const
/** The drop tower: `r` from the volcano's axis, falling to `floorUp` over its base. */
const TOWER = { r: 780, floorUp: 50 } as const
/** How far past the flank the level run out of the volcano goes before it starts down. */
const EXIT_PAST = 3 * EYE
/** Round south-west at the volcano's floor, and out. */
const FLOOR_TURN = { angle: -135 * DEG, radius: 220 } as const
/** The turn from south-west onto the camelbacks' line, west. */
const SW_TURN = 400
/** Down from the volcano's floor over `descent` of the diagonal to `y`, two airtime hills, then west along `z`. */
const CAMEL = { descent: 300, z: 300, toX: -800, rise: 50, crest: 220, angle: 26 * DEG, y: 40 } as const
const WEST_X = -1200
/** Backwards north along `WEST_X`, round east on `HOME_TURN` and on to the turntable at `HOME_X`. */
const HOME_TURN = 300
const HOME_X = -850

/** The storyboard's beats: the second the car reaches the `nth` element of a kind, its start or (`middle`) its middle. */
const BEATS: { kind: MarkerKind; second: number; nth?: number; at?: 'middle' | 'end' }[] = [
  { kind: 'liftHill', second: 4 },
  { kind: 'dropTrack', second: 18 },
  { kind: 'airtimeHill', second: 30, at: 'middle' },
  { kind: 'backwards', second: 38 },
  { kind: 'backwards', second: 57, at: 'end' },
]

export interface InfernoRide {
  points: RideBuilder['points']
  markers: RideBuilder['markers']
  mechanics: RideMechanic[]
  zones: { kind: SpeedZone['kind']; from: number; to: number; speed: number; accel?: number }[]
  /** The lava tube's exit, by control point index: it runs from the station's mouth. */
  tube: number
}

/** The level run from the builder, on its heading, to `past` outside the cone's surface at `up` over its base. */
function runOutOfCone(b: RideBuilder, up: number, past: number): number {
  const p = b.position
  const f = b.forward
  const dx = p.x - VOLCANO_SITE.x
  const dz = p.z - VOLCANO_SITE.z
  const r = coneRadius(up) + past
  // |d + L f|² = r² on the ground plane, for the root ahead.
  const a = f.x * f.x + f.z * f.z
  const half = dx * f.x + dz * f.z
  return (-half + Math.sqrt(half * half - a * (dx * dx + dz * dz - r * r))) / a
}

export function buildInfernoRide(): InfernoRide {
  const b = new RideBuilder({ ...STATION, heading: EAST, eyeHeight: EYE, spacing: SPACING })
  const mechanics: RideMechanic[] = []
  const zones: InfernoRide['zones'] = []
  const zone = (kind: SpeedZone['kind'], speed: number, build: () => void, accel?: number) => {
    const from = b.points.length - 1
    build()
    zones.push({ kind, from, to: b.points.length - 1, speed, ...(accel ? { accel } : {}) })
  }
  const y = () => b.position.y
  const turn = (angle: number, radius: number, rise = 0, bank = 30 * DEG) => bankedTurn(b, { angle, radius, rise, bank, ease: 3 * EYE })
  const holeX = VOLCANO_SITE.x - coneRadius(LIFT.holeUp)
  const towerX = VOLCANO_SITE.x - TOWER.r

  mechanics.push(station(b, { speed: SPEED.launch }))
  b.mark('straight', () => b.straight(TUBE.length))
  const tubeTo = b.points.length - 1
  b.mark('straight', () => straightTo(b, 'x', LIFT.fromX))
  zone('lift', SPEED.lift, () => b.mark('liftHill', () => straightTo(b, 'x', holeX, { rise: VOLCANO_BASE_Y + LIFT.holeUp - y(), ease: 10 * EYE })))
  b.mark('straight', () => straightTo(b, 'x', towerX))
  mechanics.push(dropTrack(b, { height: LIFT.holeUp - TOWER.floorUp, radius: 2 * EYE }))
  zone('brake', SPEED.fall, () => turn(FLOOR_TURN.angle, FLOOR_TURN.radius))
  // South-west, out through the flank, down onto the plain and over the camelbacks to the turn west onto `CAMEL.z`.
  b.mark('headChopper', () => b.straight(runOutOfCone(b, TOWER.floorUp, EXIT_PAST)))
  zone('launch', SPEED.camel, () => b.mark('straight', () => climbingStraight(b, CAMEL.descent, { rise: CAMEL.y - y(), ease: 6 * EYE })))
  b.mark('straight', () => b.straight((CAMEL.z - SW_TURN * (1 - Math.SQRT1_2) - b.position.z) * Math.SQRT2))
  turn(-45 * DEG, SW_TURN)
  for (let i = 0; i < 2; i++) airtimeHill(b, { rise: CAMEL.rise, crestRadius: CAMEL.crest, angle: CAMEL.angle })
  b.mark('straight', () => straightTo(b, 'x', CAMEL.toX))
  turn(-Math.PI / 2, CAMEL.toX - WEST_X)
  b.mark('straight', () => b.straight(STOP_APPROACH + 2 * EYE))
  // Backwards from the turntable: north, round east and on towards the station, facing the Titan the whole way.
  mechanics.push(
    backwards(
      b,
      () => {
        b.mark('straight', () => straightTo(b, 'z', STATION.z + HOME_TURN))
        turn(-Math.PI / 2, HOME_TURN)
        b.mark('straight', () => straightTo(b, 'x', HOME_X))
      },
      { speed: SPEED.backwards },
    ),
  )
  zone('brake', SPEED.brake, () => b.mark('straight', () => straightTo(b, 'x', STATION.x - SPACING)))
  return { points: b.points, markers: b.markers, mechanics, zones, tube: tubeTo }
}

/** The ride's v2 spec, mechanics, lava tube and the storyboard's beats placed on the built track. */
export function buildInfernoTrack(): SplineTrackParams {
  const ride = buildInfernoRide()
  const points = trimUnrolledUps(ride.points)
  const curve = createSplineCurve(points)
  const share = (i: number) => curve.knotT(i)
  const zones: SpeedZone[] = ride.zones.map((z) => ({ ...z, from: share(z.from), to: share(z.to) }))
  const beats: RideBeat[] = BEATS.map(({ kind, second, nth = 0, at }) => {
    const m = ride.markers.filter((k) => k.kind === kind)[nth]
    if (!m) throw new Error(`inferno ride: no ${kind} for its beat`)
    return { at: share(at === 'end' ? m.to : at === 'middle' ? Math.round((m.from + m.to) / 2) : m.from), second }
  })
  const rideV2: RideV2Spec = { zones, beats, drag: RIDE_V2_DEFAULTS.drag / 2 }
  const length = buildArcTable(curve).length
  const mouth = 2 * getTunnelDims(getTrackDimensions({ scalar: SCALAR }).trackScale).portalDepth
  const tunnels: TunnelSpec[] = [{ from: mouth / length, length: share(ride.tube) * length - mouth }]
  return {
    curve: 'spline',
    controlPoints: points,
    scalar: SCALAR,
    ride: 'v2',
    rideV2,
    mechanics: placeMechanics(curve, ride.mechanics),
    tunnels,
    color1: 0x2a2a2a,
    color2: 0xff4400,
    glow: 1.0,
  }
}

export const INFERNO_TRACK: SplineTrackParams = buildInfernoTrack()
