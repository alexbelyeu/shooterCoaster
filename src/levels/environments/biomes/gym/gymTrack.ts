/**
 * Level 6's ride (#514, rebuilt from the ride kit's storyboard in #700, `docs/RIDE-KIT.md`), pure: a v2 ride (gravity,
 * speed zones, beats) built by the ride elements' turtle (`src/track/elements/`) through the Climbing Gym's blockout, in its
 * metres, round its anchors (`blockout.ts`). The storyboard, with the second each beat lands (`GYM_BEATS`):
 *
 * - **0 s, the station** on the black path: GO launches it north, climbing at the Flame.
 * - **6–11 s, over the Flame**: a wide braking turn onto it and a slow heartline roll across it (~5 s), the fire over
 *   your head at its middle (8.5 s).
 * - **11–18 s, the dark cave**: down into the Training Area under its lintel (13 s), round north through it, out at its
 *   north end on a launch across the hall to Alaska (the route choice, #702).
 * - **21.5 s, the wall ride**: straight up Alaska on a chain, rolling onto its back at the trusses (~21 m) to tip over north.
 * - **26 s, the dyno**: a jump gap off Alaska's top to the Shield.
 * - **28 s, the auto-belay drop**: the car stops on the Shield's top, then falls upright with its piece of track into the pit.
 * - **36 s, the Medusa helix**: a climbing U-turn out of the Shield's corner and up out of the pit, then a level helix that
 *   brakes all the way round and comes out facing the star as she rises (40 s), and a slow chain lift up the hall
 *   straight at her face (40–44 s, the star in view the whole way).
 * - **44 s, the dive** round her shoulder, down toward the Tree, along its roots, the hairpin in its left cave.
 * - **54–59 s, the Tree**: a slow heartline roll through the gap between its trunk and the back wall (56.5 s), out of its
 *   right cave.
 * - **After the run**, home: a chain out of the pit over its railing, down the hall's east side, the Arch's head-chopper
 *   under its lintel, and round into the station.
 *
 * Comfort (#761, `src/track/rideComfort.ts`): the ride runs at level 1's gravity and speeds in world units, so at 48 units a
 * metre the car takes the hall at 2–7 m/s (12 m/s across it, ~14 m/s at the bottom of the drop), and every element is
 * spaced and braked so the view never turns faster than ~95°/s in any second of the run.
 *
 * `gymTrack.test.ts` holds it to the beats, the blockout's and the hall's clearances and the Medusa's;
 * `scripts/plot-gym-track.mjs` draws it. The level rides its copy in `gymLevel.ts` (`node scripts/gen-gym-level.mjs`),
 * which keeps the blockout out of the startup JS.
 */
import * as THREE from 'three'
import type { RideBeat, RideMechanic, RideV2Spec, SpeedZone, TrackParams } from '@/types/level'
import { createSplineCurve, type RailPoint } from '@/track/curves/SplineCurve'
import { RideBuilder, type MarkerKind, type Twist } from '@/track/elements/rideBuilder'
import { headChopper } from '@/track/elements/headChopper'
import { bankedTurn } from '@/track/elements/elements'
import { bankProfile, climbingTurn, straightTo, trimUnrolledUps } from '@/track/elements/climbing'
import { dropTrack, jumpGap, placeMechanics, station } from '@/track/elements/mechanicElements'
import { getTrackDimensions } from '@/track/trackDimensions'
import { RIDE_V2_DEFAULTS } from '@/track/rideV2'
import { ARCH, FLAME, GYM_SCALE, PIT, TREE, TREE_GAP, piece, toWorld } from './blockout'

/**
 * Metres the track's centreline keeps from anything solid. The car's rails reach 0.07 m out and the rider's eye is
 * 0.13 m up at `GYM_SCALE` 48 (`EYE`), so 0.8 m is about six eye heights, and it fits the ride through the Tree's gap (#613).
 */
export const RAIL_CLEARANCE = 0.8

/** Level 1's structure scale (trackScale 1): a small car in the big hall (#592). */
const SCALAR = 20
/** The rider's eye over the rails, metres. */
const EYE = getTrackDimensions({ scalar: SCALAR }).eyeHeight / GYM_SCALE
/** Metres between the turtle's control points (an element's twist drops more). */
const SPACING = 1.2
/** The ride's gravity in the blockout's metres (9.4 m/s²: the hall is real size). */
const G = RIDE_V2_DEFAULTS.gravity / GYM_SCALE
/** How far the Arch's lintel passes over the rider's eye: over the clearance, with room for the drawn soffit's facets. */
const CHOP_GAP = RAIL_CLEARANCE + 0.3

/** Air and rolling drag (`RideV2Spec.drag`): a third of the default, so the launch carries the car over the Flame. */
const DRAG = RIDE_V2_DEFAULTS.drag / 3

/**
 * Speeds in metres per second, at the rider's scale (#761): about level 1's speeds in world units (a median of ~115–190 units a
 * second; the launch across the hall and the drop's bottom ~600–700), so the small car takes the big hall at the pace level 1
 * takes its park.
 */
const SPEED = { launch: 9, climb: 7, roll: 2.3, caveDrop: 6, cave: 5, caveLaunch: 12, wallLift: 6, jump: 6.5, caught: 3.2, helixLift: 7, faceOff: 2, dive: 3.5, tree: 2, treeRoll: 2, treeOut: 2.5, home: 4 } as const

/** Rails over the black path through the station, its start, and its line along the path. */
const STATION_Y = 1
const STATION_X = 63
const STATION_Z = 33.3
/** Where the rails cross the Flame: high enough that the roll clears its flared footprint. */
const ROLL_Y = 6
/** Under the Training Area's cave's lintel, and inside it between its pads and roof. */
const CAVE_LINTEL_Y = 2.6
const CAVE_Y = 1.9
/** The cave's loop: in at the Flame's line, round north inside it, out at its north end onto the run to Alaska. */
const CAVE_IN_Z = -2.4
const CAVE_TURN = 3.5
/** How far a shot's muzzle flash lights the dark cave's rats (#752), in blockout metres. */
const CAVE_FLASH_REACH = 14
/** How far before the cave's lintel the light starts going, in blockout metres. */
const CAVE_DIM_RUN = 3
/** The climb up Alaska: the rails this far from the hall's west wall, and their top under the trusses. */
const WALL_Z = 37
const WALL_X = 32
const WALL_TOP_Y = 20.4
/** The wall ride's bends: off the run onto the wall, the roll on the wall, and over its top. */
const WALL_BENDS = { up: 4.5, roll: 4.5, over: 4 } as const
/**
 * The Medusa's face-off: the helix turns round, level, over the hall's floor east of the pit (its start x, height) onto a
 * chain lift up the hall at the star along `z` up to `topY` (pitching the view up to her crown snake), which
 * turns away round her shoulder at `turnX` on `diveTurn`.
 */
const FACE_OFF = { helixX: 24, helixY: 7.5, z: 22, topY: 8.5, turnX: 17.5, diveTurn: 5 } as const
/** The U-turn out of the drop's corner, and the helix's braking (m/s²) from its approach's speed to the face-off's crawl. */
const CAUGHT_TURN = 2.5
/** Brakes' decelerations, m/s²: round onto the Flame, at the cave's mouth, and round the helix to the face-off's crawl. */
const BRAKES = { turnIn: 2.8, cave: 10, helix: 1.6 } as const
/** Rails over the pit's floor at its lowest, clear of its benches. */
const PIT_LOW_Y = PIT.floorY + 1.65
/** Rails through the Tree's gap: clear of the floor's roots, the rider's eye under the gap's ceiling. */
const GAP_Y = PIT.floorY + 2.4
/**
 * The dive's heights, spread over its whole length so it never plunges: out of the turn round her shoulder, at the turn
 * along the roots, along their front, and into the hairpin (which goes on down to the gap).
 */
const DIVE = { turned: 4, roots: 2.6, hairpin: GAP_Y + 0.5 } as const
/** Out from the Tree's foot line, the middle of its gap. */
const GAP_F = (TREE_GAP.minF + TREE_GAP.maxF) / 2
/** Out from the Tree's foot line along the roots' front, and the hairpin's centre along the Tree. */
const ROOTS_F = 6.375
const HAIRPIN_ALONG = -5.6
/** The Tree's right cave's mouth, where the ride turns out of the gap. */
const MOUTH_X = 18.6
/**
 * The way home after the run, down the hall's east side: over the run to Alaska (`overY`) and under the dive to the cave
 * (`underY`) along `z`, then through the Arch at `archX`, down over its pads (`padY`) and round into the station.
 */
const HOME = { z: 14, overY: 5, underY: 2.2, archX: 75, archTurn: 4, stationTurn: 3, padY: 1.2 } as const

/** The V8 way round (#702): where it forks off the run to Alaska and merges back (z), and its points in between. */
const V8 = {
  fork: 11,
  merge: 32,
  points: [
    { x: 28.5, y: 1.6, z: 16 },
    { x: 25.9, y: 1.3, z: 22 },
    { x: 28.5, y: 1.6, z: 28 },
  ],
} as const

/**
 * The storyboard's beats: the second the car reaches an element (the `nth` of its kind, the first by default), its start
 * or (`middle`) its middle.
 */
const BEATS: { kind: MarkerKind; second: number; nth?: number; middle?: true }[] = [
  { kind: 'heartlineRoll', second: 8.5, middle: true },
  { kind: 'headChopper', second: 13, middle: true },
  { kind: 'liftHill', second: 21.5 },
  { kind: 'jumpGap', second: 26 },
  { kind: 'helix', second: 36 },
  { kind: 'liftHill', nth: 1, second: 40 },
  { kind: 'heartlineRoll', nth: 1, second: 56.5, middle: true },
]

const DEG = Math.PI / 180
/** Heading up the hall, toward the Starr (−x). */
const NORTH = -Math.PI / 2

/** The share of a slow roll's length its rate builds up over, and dies away over at its end. */
const ROLL_EASE = 0.2

/**
 * A slow heartline roll (#761), `hand` 1 to the right: the roll rate ramps up over its first `ROLL_EASE`, holds, and ramps
 * down over its last, so a full roll turns the view no faster than 360° / (0.8 × its seconds), where a smoothstep peaks at
 * 1.5 × the average.
 */
function slowRoll(hand: 1 | -1): Twist {
  const e = ROLL_EASE
  const ridden = (u: number) => (u < e ? (u * u) / (2 * e) : u > 1 - e ? 1 - e - ((1 - u) * (1 - u)) / (2 * e) : u - e / 2)
  return { at: (u) => (hand * 2 * Math.PI * ridden(u)) / (1 - e), heartline: 0.6 * EYE }
}

/** The gym's banked turn: 30° unless told, climbing on pitches of 3 m. */
const turn = (b: RideBuilder, angle: number, radius: number, rise = 0, bank = 30 * DEG) => bankedTurn(b, { angle, radius, rise, bank, ease: 3 })

/** A straight to `value` along `axis`, climbing `rise` on pitches of `ease` m. */
const to = (b: RideBuilder, axis: 'x' | 'z', value: number, rise = 0, ease = 4) => straightTo(b, axis, value, { rise, ease })

/** A point `along` the Tree from its centre and `f` out from its foot line. */
function treeFrame(along: number, f: number): { x: number; z: number } {
  return {
    x: TREE.centre.x + TREE.along.x * along + TREE.facing.x * f,
    z: TREE.centre.z + TREE.along.z * along + TREE.facing.z * f,
  }
}

export interface GymRide {
  /** Control points in blockout metres, with the rails' up where the track rolls. */
  points: RailPoint[]
  markers: RideBuilder['markers']
  /** By control point index (`placeMechanics` turns them into arc shares), speeds in metres per second. */
  mechanics: RideMechanic[]
  zones: { kind: SpeedZone['kind']; from: number; to: number; speed: number; accel?: number }[]
  /** The Training Area's dark cave (#752), by control point index: in under its lintel (`from`), dark (`dark`), out on its launch (`out`). */
  cave: { from: number; dark: number; out: number }
}

/** The ride, element by element, in blockout metres. */
export function buildGymRide(): GymRide {
  const b = new RideBuilder({ x: STATION_X, y: STATION_Y, z: STATION_Z, heading: NORTH, eyeHeight: EYE, spacing: SPACING })
  const mechanics: RideMechanic[] = []
  const zones: GymRide['zones'] = []
  const zone = (kind: SpeedZone['kind'], speed: number, build: () => void, accel?: number) => {
    const from = b.points.length - 1
    build()
    zones.push({ kind, from, to: b.points.length - 1, speed, ...(accel ? { accel } : {}) })
  }
  const y = () => b.position.y

  // 0 s: the station on the black path; GO launches north along it, climbing, and a wide right turn heads it at the Flame.
  mechanics.push(station(b, { speed: SPEED.launch, length: 6 }))
  const firstTurn = 5
  zone('lift', SPEED.climb, () => b.mark('straight', () => to(b, 'x', FLAME.centre.x + firstTurn, ROLL_Y - y())))
  // 8 s: braking round onto the Flame, a slow heartline roll across it, upside down over the fire at its middle.
  zone('brake', SPEED.roll, () => turn(b, -Math.PI / 2, firstTurn, 0, 20 * DEG), BRAKES.turnIn)
  zone('lift', SPEED.roll, () => b.mark('heartlineRoll', () => b.straight(2 * (b.position.z - FLAME.centre.z), slowRoll(1))))

  // 13 s: down into the Training Area's cave under its lintel, round north through it in the dark, out at its north end.
  const caveDrop = b.points.length
  zone('launch', SPEED.caveDrop, () => b.mark('headChopper', () => to(b, 'z', CAVE_IN_Z, CAVE_LINTEL_Y - y(), 5)))
  const caveDark = b.points.length - 1
  // The light goes over the drop's last few metres to the lintel, not the whole way down from the Flame.
  const caveFrom = b.points.findIndex((p, i) => i >= caveDrop && Math.abs(p.z - CAVE_IN_Z) <= CAVE_DIM_RUN)
  zone(
    'brake',
    SPEED.cave,
    () => {
      turn(b, Math.PI / 2, CAVE_TURN, 0, 20 * DEG)
      b.mark('straight', () => to(b, 'x', WALL_X + CAVE_TURN, CAVE_Y - y(), 3))
      turn(b, Math.PI / 2, CAVE_TURN, CAVE_LINTEL_Y - y(), 20 * DEG)
    },
    BRAKES.cave,
  )
  const cave = { from: caveFrom, dark: caveDark, out: b.points.length - 1 }
  // Bursting out of the cave on a launch, across the hall to Alaska.
  zone('launch', SPEED.caveLaunch, () => b.mark('straight', () => to(b, 'z', 4)))
  // The route choice (#702): shoot the switch and the V8 way round swings east off the line, down over the Flame's pads
  // beside its boulder, and back onto the line before Alaska.
  b.mark('straight', () => to(b, 'z', V8.fork))
  const fork = b.points.length - 1
  b.mark('straight', () => to(b, 'z', V8.merge))
  mechanics.push({ kind: 'junction', from: fork, to: b.points.length - 1, points: V8.points })
  b.mark('straight', () => to(b, 'z', WALL_Z - WALL_BENDS.up))

  // 21 s: the wall ride, straight up Alaska on a chain, rolling onto its back at the top to tip over north.
  zone('lift', SPEED.wallLift, () =>
    b.mark('liftHill', () => {
      b.pitch(Math.PI / 2, WALL_BENDS.up)
      b.straight(WALL_TOP_Y - y() - (Math.PI / 2) * WALL_BENDS.roll - WALL_BENDS.over)
      b.arc(-Math.PI / 2, new THREE.Vector3(0, 0, 1), WALL_BENDS.roll)
      b.pitch(-Math.PI / 2, WALL_BENDS.over)
    }),
  )
  // 29 s: the dyno off Alaska's top to the Shield; the Shield's auto belay, then the drop into the pit.
  mechanics.push(jumpGap(b, { speed: SPEED.jump, gravity: G, booster: 2, ramp: 3 }))
  b.mark('straight', () => b.straight(1))
  mechanics.push(dropTrack(b, { height: y() - PIT_LOW_Y, radius: 1, seconds: 0.6 }))
  zone('brake', SPEED.caught, () => b.mark('straight', () => b.straight(2.5)), 60)
  zone('lift', SPEED.caught, () => turn(b, -Math.PI, CAUGHT_TURN, 1.5, 25 * DEG))

  // 35 s: the Medusa helix. A climbing turn out of the Shield's corner, up the pit along the Shield and out over the
  // hall's floor, then the helix: a banked climbing turn round that ends facing the star as she rises (40 s), and a
  // chain lift straight at her face.
  zone('lift', SPEED.helixLift, () => b.mark('straight', () => to(b, 'x', FACE_OFF.helixX, FACE_OFF.helixY - y())))
  // The helix slows the car all the way round, onto the chain at her face.
  zone('brake', SPEED.faceOff, () => b.mark('helix', () => climbingTurn(b, Math.PI, (b.position.z - FACE_OFF.z) / 2, { twist: bankProfile(25 * DEG) })), BRAKES.helix)
  zone('lift', SPEED.faceOff, () => b.mark('liftHill', () => to(b, 'x', FACE_OFF.turnX, FACE_OFF.topY - y(), 3)))
  // 45 s: the dive round her shoulder, down toward the Tree, and along its roots' front.
  const roots = treeFrame(0, ROOTS_F)
  const rootsTurn = 2.5
  zone('brake', SPEED.dive, () => {
    turn(b, -Math.PI / 2, FACE_OFF.diveTurn, DIVE.turned - y(), 25 * DEG)
    b.mark('straight', () => to(b, 'z', roots.z + rootsTurn, DIVE.roots - y()))
    turn(b, Math.PI / 2, rootsTurn, 0, 25 * DEG)
    b.mark('straight', () => to(b, 'x', treeFrame(HAIRPIN_ALONG, 0).x, DIVE.hairpin - y()))
  })
  const caveOut = 2.2
  // The hairpin in the left cave's mouth into the gap.
  zone('brake', SPEED.tree, () => turn(b, -Math.PI, (ROOTS_F - GAP_F) / 2, GAP_Y - y(), 20 * DEG))
  zone('lift', SPEED.treeRoll, () => {
    // 54 s: a slow heartline roll through the Tree's gap, on out of the right cave's mouth.
    b.mark('heartlineRoll', () => b.straight(MOUTH_X - caveOut - b.position.x, slowRoll(-1)))
    turn(b, -Math.PI / 2, caveOut)
  })
  // After the run, the way home: a chain out of the pit over its railing, down the hall's east side over the run to
  // Alaska and under the way into the cave, a right turn into the Arch, the head-chopper under its lintel, and round
  // into the station.
  const lintel = piece('arch')
  const chop = headChopper(
    {
      min: { x: ARCH.centre.x - ARCH.width / 2, y: lintel.openingHeight, z: ARCH.centre.z - ARCH.depth / 2 },
      max: { x: ARCH.centre.x + ARCH.width / 2, y: lintel.height, z: ARCH.centre.z + ARCH.depth / 2 },
    },
    { x: 0, y: -1, z: 0 },
    { eyeHeight: EYE, clearance: RAIL_CLEARANCE, gap: CHOP_GAP },
  )
  const archOut = ARCH.centre.z + ARCH.depth / 2 + 0.5
  zone('lift', SPEED.treeOut, () => {
    b.mark('straight', () => to(b, 'z', HOME.z - 2, 2.2 - y(), 3))
    turn(b, Math.PI / 2, 2, 0.5)
  })
  zone('lift', SPEED.home, () => {
    b.mark('straight', () => to(b, 'x', WALL_X - 3, HOME.overY - y(), 3))
    b.mark('straight', () => to(b, 'x', WALL_X + 6))
    b.mark('straight', () => to(b, 'x', FLAME.centre.x - 3, HOME.underY - y(), 3))
    b.mark('straight', () => to(b, 'x', HOME.archX - HOME.archTurn, chop.rail.y - y(), 4))
    turn(b, -Math.PI / 2, HOME.archTurn)
    b.mark('straight', () => to(b, 'z', ARCH.centre.z - ARCH.depth / 2 - 0.5))
    b.mark('headChopper', () => to(b, 'z', archOut))
    b.mark('straight', () => to(b, 'z', STATION_Z - HOME.stationTurn, HOME.padY - y(), 2))
    turn(b, -Math.PI / 2, HOME.stationTurn)
  })
  b.mark('straight', () => to(b, 'x', STATION_X + SPACING, STATION_Y - y()))
  return { points: b.points, markers: b.markers, mechanics, zones, cave }
}

const toWorldPoint = (p: RailPoint): RailPoint => ({ ...toWorld(p), ...(p.up ? { up: p.up } : {}) })

/** The ride in world units, its v2 spec, mechanics and the storyboard's beats placed on the built track. */
export function buildGymTrack(): TrackParams {
  const ride = buildGymRide()
  const points = trimUnrolledUps(ride.points).map(toWorldPoint)
  const curve = createSplineCurve(points)
  const share = (i: number) => curve.knotT(i)
  const world = GYM_SCALE
  const mechanics = placeMechanics(curve, ride.mechanics).map((m) => {
    if (m.kind === 'junction') return { ...m, points: m.points.map(toWorld) }
    return 'speed' in m ? { ...m, speed: m.speed * world } : m
  })
  const zones: SpeedZone[] = ride.zones.map((z) => ({ kind: z.kind, from: share(z.from), to: share(z.to), speed: z.speed * world, ...(z.accel ? { accel: z.accel * world } : {}) }))
  const beats: RideBeat[] = BEATS.map(({ kind, second, nth = 0, middle }) => {
    const m = ride.markers.filter((k) => k.kind === kind)[nth]
    if (!m) throw new Error(`gym ride: no ${kind} for its beat`)
    return { at: share(middle ? Math.round((m.from + m.to) / 2) : m.from), second }
  })
  const rideV2: RideV2Spec = { zones, beats, drag: DRAG }
  // The cave rides dark (#752): the light goes under its lintel and comes back over as long on its launch out.
  const caveRamp = share(ride.cave.dark) - share(ride.cave.from)
  const darkSections = [{ from: share(ride.cave.from), to: share(ride.cave.out) + caveRamp, ramp: caveRamp, flashReach: CAVE_FLASH_REACH * world }]
  return {
    curve: 'spline',
    controlPoints: points,
    // Level 1's structure scale (trackScale 1): a small car in the big hall (#592).
    scalar: SCALAR,
    ride: 'v2',
    rideV2,
    mechanics,
    darkSections,
    // Rails, ties and towers sparser than level 1's (~0.86 m a segment, under 3 cm of chord sag on the tightest turn; ties
    // every ~0.6 m and towers every ~23 m of the hall at 48 units a metre): the ~350 m track leaves the scene room under
    // `scene.level6` for the enemies in the air at 10 s (#726, #761).
    segments: 400,
    tieSpacing: 30,
    towerSpacing: 1100,
    color1: 0x353d48,
    color2: 0x22d3c5,
  }
}

export const GYM_TRACK: TrackParams = buildGymTrack()

