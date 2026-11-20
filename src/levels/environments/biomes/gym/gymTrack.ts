/**
 * Level 6's ride (#514, rebuilt from the ride kit's storyboard in #700, `docs/RIDE-KIT.md`), pure: a v2 ride (gravity,
 * speed zones, beats) built by the ride elements' turtle (`src/track/elements/`) through the Climbing Gym's blockout, in its
 * metres, round its anchors (`blockout.ts`). The storyboard, with the second each beat lands (`GYM_BEATS`):
 *
 * - **0 s, the station** on the black path inside the entrance: GO launches it north at the Flame.
 * - **4 s, the zero-g roll** over the Flame: the fire over your head.
 * - **8 s, the Arch**: a head-chopper under its lintel, then a climbing U-turn over the Wave.
 * - **12 s, the airtime hill** past the cubbies (its slow-motion window), and into the Training Area's cave.
 * - **15 s, the dark cave**: a head-chopper under its lintel, an S through it, out at its north end (where the route choice goes, #702).
 * - **22 s, the wall ride**: straight up Alaska on a chain, rolling over at the trusses (~21 m) to head north.
 * - **30 s, the dyno**: a jump gap off Alaska's top to the Shield.
 * - **31.5 s, the auto-belay drop**: the car stops on the Shield's top, then free-falls with its piece of track into the pit.
 * - **37 s, the Medusa helix**: three climbing turns on a chain in the pit's corner beside the star, as she rises (40 s).
 * - **47 s, the dive** round her shoulders, along the Tree's roots, the hairpin in its left cave.
 * - **55 s, the Tree**: a heartline roll through the gap between its trunk and the back wall, out of its right cave.
 * - **58 s, the brake run** over the pit's railing. After the run, a chain brings the car home round the hall's west side.
 *
 * `gymTrack.test.ts` holds it to the beats, the blockout's and the hall's clearances and the Medusa's;
 * `scripts/plot-gym-track.mjs` draws it. The level rides its copy in `gymLevel.ts` (`node scripts/gen-gym-level.mjs`),
 * which keeps the blockout out of the startup JS.
 */
import * as THREE from 'three'
import type { RideBeat, RideMechanic, RideV2Spec, SpeedZone, TrackParams } from '@/types/level'
import { createSplineCurve, type RailPoint } from '@/track/curves/SplineCurve'
import { RideBuilder, smoothstep, type MarkerKind, type Twist } from '@/track/elements/rideBuilder'
import { airtimeHill, zeroGRoll } from '@/track/elements/elements'
import { headChopper } from '@/track/elements/headChopper'
import { dropTrack, jumpGap, placeMechanics, station } from '@/track/elements/mechanics'
import { getTrackDimensions } from '@/track/trackDimensions'
import { RIDE_V2_DEFAULTS } from '@/track/rideV2'
import { ARCH, FLAME, GYM_SCALE, PIT, TREE, TREE_GAP, piece, toWorld, type Vec3 } from './blockout'

/**
 * Metres the track's centreline keeps from anything solid. The car's rails reach 0.07 m out and the rider's eye is
 * 0.19 m up (#592), so 0.8 m is still four eye heights, and it fits the ride through the Tree's gap (#613).
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
const CHOP_GAP = RAIL_CLEARANCE + 0.2

/** Air and rolling drag (`RideV2Spec.drag`): a third of the default, so the launch carries the car over the Flame. */
const DRAG = RIDE_V2_DEFAULTS.drag / 3

/** Speeds in metres per second. */
const SPEED = { launch: 18, caveLaunch: 11, jump: 8, wallLift: 4, helixLift: 5, caught: 6, tree: 7, home: 4 } as const

/** Rails over the black path through the station. */
const STATION_Y = 1
/** The station's line along the path; the way home up the hall, and along the Slab's mats beside the path. */
const STATION_Z = 33.3
const HOME_X = 24.6
const HOME_Z = 35.3
/** The Tree's right cave's mouth, where the ride turns out of the gap. */
const MOUTH_X = 18.6
/** Where the rails cross the Flame: high enough that the roll clears its flared footprint. */
const ROLL_Y = 6
/** The line along the hall's east side, out from the Lagoon's walls, past the cubbies. */
const CUBBY_Z = 3.6
/** Inside the Training Area's cave, between its pads and roof. */
const CAVE_Y = 1.9
/** The climb up Alaska: the rails this far from the hall's west wall, and their top under the trusses. */
const WALL_Z = 37
const WALL_X = 26.5
const WALL_TOP_Y = 20.4
/** The pit's corner helix beside the star, clear of the Shield and the Medusa. */
const HELIX = { x: 8, radius: 2.1, turns: 2.5, climb: 10.5 } as const
/** Rails over the pit's floor at its lowest (clear of its benches) and along the roots' front. */
const PIT_LOW_Y = PIT.floorY + 1.65
const ROOTS_Y = PIT.floorY + 2.3
/** The dive's height where it turns along the roots, over the way out of the Tree. */
const DIVE_LOW_Y = 4
/** Rails through the Tree's gap: clear of the floor's roots, the rider's eye under the gap's ceiling. */
const GAP_Y = PIT.floorY + 1.8
const GAP_F = (TREE_GAP.minF + TREE_GAP.maxF) / 2
/** Out from the Tree's foot line along the roots' front, and the hairpin's centre along the Tree. */
const ROOTS_F = 6.375
const HAIRPIN_ALONG = -5.6

/** The V8 way round (#702): where it forks off the run to Alaska and merges back (z), and its points in between. */
const V8 = {
  fork: 11,
  merge: 32,
  points: [
    { x: 30, y: 1.6, z: 16 },
    { x: 32.6, y: 1.3, z: 22 },
    { x: 30, y: 1.6, z: 28 },
  ],
} as const

/** The storyboard's beats: the second the car reaches the first element of a kind, its start or (`middle`) its middle. */
const BEATS: { kind: MarkerKind; second: number; middle?: true }[] = [
  { kind: 'zeroGRoll', second: 4, middle: true },
  { kind: 'headChopper', second: 8, middle: true },
  { kind: 'slowMotion', second: 12, middle: true },
  { kind: 'liftHill', second: 22 },
  { kind: 'jumpGap', second: 30 },
  { kind: 'helix', second: 37 },
  { kind: 'heartlineRoll', second: 55, middle: true },
]

const DEG = Math.PI / 180
/** Heading up the hall, toward the Starr (−x). */
const NORTH = -Math.PI / 2

/** A bank held through a turn: eased in over its first quarter and out over its last. */
function bank(angle: number): Twist {
  return { at: (u) => angle * smoothstep(u / 0.25) * smoothstep((1 - u) / 0.25) }
}

/**
 * The grade that climbs (or falls) `dy` over `length` of track eased in and out on pitches of `ease`: solves
 * dy = 2·ease·(1 − cos g) + length·sin g.
 */
function gradeFor(length: number, dy: number, ease: number): number {
  let g = 0
  for (let i = 0; i < 12; i++) g = Math.asin(Math.max(-0.95, Math.min(0.95, (dy - Math.sign(dy) * 2 * ease * (1 - Math.cos(g))) / length)))
  return g
}

/** Straight on `run` metres of ground, climbing `dy` on the way (pitched in and out on `ease`). */
function straight(b: RideBuilder, run: number, dy = 0, ease = 4): void {
  if (Math.abs(dy) < 1e-6) {
    b.straight(run)
    return
  }
  // The pitches cover 2·e·sin g of ground and climb 2·e·(1 − cos g), the grade the rest: bisect for the grade, easing
  // in on tighter pitches when even the steepest grade that fits can't climb it.
  const rise = Math.abs(dy)
  let e = ease
  const climb = (g: number) => 2 * e * (1 - Math.cos(g)) + ((run - 2 * e * Math.sin(g)) / Math.cos(g)) * Math.sin(g)
  const steepest = () => Math.min(Math.asin(Math.min(run / (2 * e), 1)), 1.4)
  while (climb(steepest()) < rise) e *= 0.8
  let lo = 0
  let hi = steepest()
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (climb(mid) < rise) lo = mid
    else hi = mid
  }
  const g = Math.sign(dy) * lo
  const middle = Math.max((run - 2 * e * Math.sin(lo)) / Math.cos(lo), 0)
  b.pitch(g, e)
  if (middle > 1e-3) b.straight(middle)
  b.pitch(-g, e)
}

/** A level turn of `angle` (positive left) on `radius` metres, climbing `dy`, banked into it. */
function turn(b: RideBuilder, angle: number, radius: number, dy = 0, tilt = 30 * DEG, ease = 3): void {
  const twist = bank(Math.sign(angle) * tilt)
  if (Math.abs(dy) < 1e-6) {
    b.turn(angle, radius, twist)
    return
  }
  const g = gradeFor(Math.abs(angle) * radius, dy, ease)
  b.pitch(g, ease)
  b.turn(angle, radius / Math.cos(g), twist)
  b.pitch(-g, ease)
}

/** Straight on until the builder is at `x` (heading along x) or `z` (heading along z). */
function to(b: RideBuilder, axis: 'x' | 'z', value: number, dy = 0, ease = 4): void {
  const run = Math.abs(value - b.position[axis])
  straight(b, run, dy, ease)
}

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
}

/** The ride, element by element, in blockout metres. */
export function buildGymRide(): GymRide {
  const b = new RideBuilder({ x: 73, y: STATION_Y, z: STATION_Z, heading: NORTH, eyeHeight: EYE, spacing: SPACING })
  const mechanics: RideMechanic[] = []
  const zones: GymRide['zones'] = []
  const zone = (kind: SpeedZone['kind'], speed: number, build: () => void, accel?: number) => {
    const from = b.points.length - 1
    build()
    zones.push({ kind, from, to: b.points.length - 1, speed, ...(accel ? { accel } : {}) })
  }
  const y = () => b.position.y

  // 0 s: the station on the black path; GO launches north along it, climbing, and a right turn heads it at the Flame.
  mechanics.push(station(b, { speed: SPEED.launch, length: 16 }))
  const firstTurn = 4.5
  const rollLength = 2 * FLAME.halfZ + 2.2
  b.mark('straight', () => to(b, 'x', FLAME.centre.x + firstTurn, ROLL_Y - y()))
  b.mark('bankedTurn', () => turn(b, -Math.PI / 2, firstTurn))
  b.mark('straight', () => to(b, 'z', FLAME.centre.z + rollLength / 2))
  // 4 s: the zero-g roll over the Flame (the element's length is each half's).
  zeroGRoll(b, { length: rollLength / 2, angle: Math.PI / 7, hand: 1 })

  // South down the east side, then a right turn into the Arch, under its lintel.
  const archTurn = 6
  const archIn = ARCH.centre.z - ARCH.depth / 2 - 1.4
  const lintel = piece('arch')
  const chop = headChopper(
    { min: { x: ARCH.centre.x - ARCH.width / 2, y: lintel.openingHeight, z: archIn }, max: { x: ARCH.centre.x + ARCH.width / 2, y: lintel.height, z: -archIn } },
    { x: 0, y: -1, z: 0 },
    { eyeHeight: EYE, clearance: RAIL_CLEARANCE, gap: CHOP_GAP },
  )
  b.mark('bankedTurn', () => turn(b, -Math.PI / 2, b.position.z - (archIn - archTurn)))
  b.mark('straight', () => to(b, 'x', ARCH.centre.x - archTurn, chop.rail.y - y()))
  b.mark('bankedTurn', () => turn(b, -Math.PI / 2, archTurn))
  b.mark('straight', () => to(b, 'z', archIn))
  // 8 s: under the Arch's lintel.
  b.mark('headChopper', () => to(b, 'z', 2 * ARCH.centre.z - archIn))
  // A climbing U-turn over the Wave, down north of it, crossing over the run south, and a left turn onto the east side.
  const cubbyTurn = 3
  b.mark('bankedTurn', () => turn(b, -Math.PI, 5, 4, 35 * DEG))
  b.mark('straight', () => to(b, 'z', 17.4))
  b.mark('straight', () => to(b, 'z', 13, -0.8))
  b.mark('straight', () => to(b, 'z', CUBBY_Z + cubbyTurn, 3.2 - y(), 3))
  b.mark('bankedTurn', () => turn(b, Math.PI / 2, cubbyTurn))
  // 12 s: an airtime hill past the cubbies.
  airtimeHill(b, { rise: 2.8, crestRadius: 4, angle: 40 * DEG })
  // 15 s: right into the Training Area's cave under its lintel, an S through it in the dark, out at its north end.
  b.mark('bankedTurn', () => turn(b, -Math.PI / 2, 3.9, 0, 25 * DEG))
  b.mark('headChopper', () => to(b, 'z', -2.4, 2.6 - y(), 2))
  b.mark('bankedTurn', () => turn(b, Math.PI / 2, 3))
  b.mark('straight', () => to(b, 'x', WALL_X + 3, CAVE_Y - y(), 2))
  b.mark('bankedTurn', () => turn(b, Math.PI / 2, 3))
  b.mark('straight', () => to(b, 'z', -0.5, 2.6 - y(), 2))
  // Bursting out of the cave on a launch, across the hall to Alaska.
  zone('launch', SPEED.caveLaunch, () => b.mark('straight', () => to(b, 'z', 8)))
  // The route choice (#702): shoot the switch and the V8 way round swings east off the line, down over the Flame's pads
  // beside its boulder, and back onto the line before Alaska.
  b.mark('straight', () => to(b, 'z', V8.fork))
  const fork = b.points.length - 1
  b.mark('straight', () => to(b, 'z', V8.merge))
  mechanics.push({ kind: 'junction', from: fork, to: b.points.length - 1, points: V8.points })
  b.mark('straight', () => to(b, 'z', WALL_Z - 2))

  // 22 s: the wall ride, straight up Alaska on a chain, rolling over at the top to head north.
  zone('lift', SPEED.wallLift, () =>
    b.mark('liftHill', () => {
      b.pitch(Math.PI / 2, 2)
      b.straight(WALL_TOP_Y - y() - 6.3 - 1.5)
      b.arc(-Math.PI / 2, new THREE.Vector3(0, 0, 1), 4)
      b.pitch(-Math.PI / 2, 1.5)
    }),
  )
  // 30 s: the dyno off Alaska's top to the Shield; the Shield's auto belay, then the drop into the pit.
  mechanics.push(jumpGap(b, { speed: SPEED.jump, gravity: G, booster: 2.5, ramp: 1.5 }))
  b.mark('straight', () => b.straight(2.9))
  mechanics.push(dropTrack(b, { height: y() - PIT_LOW_Y, radius: 1 }))
  zone('brake', SPEED.caught, () => b.mark('straight', () => to(b, 'x', HELIX.x)), 60)

  // 37 s: the Medusa helix, climbing in the pit's corner beside the star.
  zone('lift', SPEED.helixLift, () =>
    b.mark('helix', () => {
      const g = Math.atan2(HELIX.climb, 2 * Math.PI * HELIX.radius * HELIX.turns)
      b.pitch(g, 2)
      b.turn(-2 * Math.PI * HELIX.turns, HELIX.radius / Math.cos(g), { at: (u) => -35 * DEG * smoothstep(u / 0.05) * smoothstep((1 - u) / 0.05) })
      b.pitch(-g, 2)
    }),
  )
  // 47 s: the dive south round her shoulders, over the way out of the Tree, down along its roots' front.
  const roots = treeFrame(0, ROOTS_F)
  const rootsTurn = 2.2
  b.mark('straight', () => to(b, 'x', 11.5))
  b.mark('bankedTurn', () => turn(b, Math.PI / 2, 5.5, -2, 40 * DEG))
  b.mark('straight', () => to(b, 'z', roots.z + rootsTurn, DIVE_LOW_Y - y()))
  b.mark('bankedTurn', () => turn(b, Math.PI / 2, rootsTurn))
  zone('brake', SPEED.tree, () => b.mark('straight', () => to(b, 'x', treeFrame(HAIRPIN_ALONG, 0).x, ROOTS_Y - y())))
  // The hairpin in the left cave's mouth into the gap.
  b.mark('bankedTurn', () => turn(b, -Math.PI, (ROOTS_F - GAP_F) / 2, GAP_Y - ROOTS_Y, 45 * DEG))
  // 55 s: a heartline roll through the Tree's gap, then out of the right cave's mouth.
  const caveOut = 2.2
  b.mark('straight', () => to(b, 'x', TREE.centre.x - TREE_GAP.halfAlong + 0.6))
  b.mark('heartlineRoll', () => b.straight(2 * TREE_GAP.halfAlong - 1.2, { at: (u) => -2 * Math.PI * smoothstep(u), heartline: 0.6 * EYE }))
  // 58 s: the brake run out of the gap, then a chain out of the pit under the dive, over its railing, and home after the run:
  // up the hall's west side, over the way to Alaska, along the Slab's mats and round into the station.
  zone('brake', SPEED.home, () => b.mark('straight', () => to(b, 'x', MOUTH_X - caveOut)))
  const homeTurn = 2.6
  zone('lift', SPEED.home, () => {
    b.mark('bankedTurn', () => turn(b, -Math.PI / 2, caveOut))
    b.mark('straight', () => to(b, 'z', 12.5, 2.2 - y(), 3))
    b.mark('bankedTurn', () => turn(b, Math.PI / 2, homeTurn, 0.5))
    b.mark('bankedTurn', () => turn(b, -Math.PI / 2, HOME_X - b.position.x))
    b.mark('straight', () => to(b, 'z', HOME_Z - 3, 2.6))
    b.mark('bankedTurn', () => turn(b, Math.PI / 2, 3))
    b.mark('straight', () => to(b, 'x', 50.5, 1.4 - y()))
    b.mark('straight', () => {
      b.turn(-25 * DEG, 4)
      b.turn(25 * DEG, 4)
    })
    b.mark('straight', () => to(b, 'x', 75))
    b.mark('bankedTurn', () => turn(b, Math.PI, (b.position.z - STATION_Z) / 2, STATION_Y - y()))
  })
  b.mark('straight', () => to(b, 'x', 73 + SPACING))
  return { points: b.points, markers: b.markers, mechanics, zones }
}

/** Drops the ups a spline would work out anyway (no roll, track not steep), keeping the level's data small. */
function trimUps(points: RailPoint[]): RailPoint[] {
  const n = points.length
  return points.map((p, i) => {
    if (!p.up) return p
    const a = points[(i - 1 + n) % n]
    const c = points[(i + 1) % n]
    const fx = c.x - a.x
    const fy = c.y - a.y
    const fz = c.z - a.z
    const fl = Math.hypot(fx, fy, fz)
    if (Math.abs(fy / fl) > 0.85) return p
    // The unrolled up: f × (world up × f), normalised.
    const ux = -fx * fy
    const uy = fx * fx + fz * fz
    const uz = -fz * fy
    const ul = Math.hypot(ux, uy, uz)
    const pl = Math.hypot(p.up.x, p.up.y, p.up.z)
    const cos = (ux * p.up.x + uy * p.up.y + uz * p.up.z) / (ul * pl)
    return cos > Math.cos(0.5 * DEG) ? { x: p.x, y: p.y, z: p.z } : p
  })
}

const toWorldPoint = (p: RailPoint): RailPoint => ({ ...toWorld(p), ...(p.up ? { up: p.up } : {}) })

/** The ride in world units, its v2 spec, mechanics and the storyboard's beats placed on the built track. */
export function buildGymTrack(): TrackParams {
  const ride = buildGymRide()
  const points = trimUps(ride.points).map(toWorldPoint)
  const curve = createSplineCurve(points)
  const share = (i: number) => curve.knotT(i)
  const world = GYM_SCALE
  const mechanics = placeMechanics(curve, ride.mechanics).map((m) => {
    if (m.kind === 'junction') return { ...m, points: m.points.map(toWorld) }
    return 'speed' in m ? { ...m, speed: m.speed * world } : m
  })
  const zones: SpeedZone[] = ride.zones.map((z) => ({ kind: z.kind, from: share(z.from), to: share(z.to), speed: z.speed * world, ...(z.accel ? { accel: z.accel * world } : {}) }))
  const beats: RideBeat[] = BEATS.map(({ kind, second, middle }) => {
    const m = ride.markers.find((k) => k.kind === kind)
    if (!m) throw new Error(`gym ride: no ${kind} for its beat`)
    return { at: share(middle ? Math.round((m.from + m.to) / 2) : m.from), second }
  })
  const rideV2: RideV2Spec = { zones, beats, drag: DRAG }
  return {
    curve: 'spline',
    controlPoints: points,
    // Level 1's structure scale (trackScale 1): a small car in the big hall (#592).
    scalar: SCALAR,
    ride: 'v2',
    rideV2,
    mechanics,
    // Rails, ties and towers sparser than level 1's (still finer per metre ridden): the track is long, under the same triangle budget.
    segments: 1600,
    tieSpacing: 22,
    towerSpacing: 300,
    // Today's rule's speeds, unused by the v2 ride.
    rollerSpeed: 0.0000004,
    minRollerSpeed: 0.000355,
    color1: 0x353d48,
    color2: 0x22d3c5,
  }
}

export const GYM_TRACK: TrackParams = buildGymTrack()

export type { Vec3 }
