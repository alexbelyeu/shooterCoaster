/**
 * Level 6's ride (#514), pure: a closed spline through the Climbing Gym's blockout, built from its
 * anchors (`blockout.ts`), never from hand-typed world numbers. In ride order from the lap start:
 *
 * 1. Through the Tree's gap under its trunk (#659): the run starts in it and climbs out of the right cave.
 * 2. Over to the Flame and a sinking spiral right round it.
 * 3. South down the east side and west through the Arch.
 * 4. A climbing right turn to the crest by the glass gym room (~39.5 s).
 * 5. The dive: down the west side and into the Starr pit, the star ahead all the way (the Medusa
 *    rises from it at 40 s). After the run, a turn south outside her bust, along the roots' front and a
 *    hairpin in the left cave's mouth close the lap back into the gap.
 *
 * Every moment's time is its share of the lap (the speeds are a fraction of the lap per frame, gravity nearly
 * off), so the crest's share against the dive's sets the star's time in view: see `docs/levels/README.md`.
 *
 * `gymTrack.test.ts` holds it to the four moments; `scripts/plot-gym-track.mjs` draws it. The level rides its copy in
 * `gymLevel.ts` (`node scripts/gen-gym-level.mjs`), which keeps the blockout out of the startup JS.
 */
import type { TrackParams } from '@/types/level'
import { ARCH, FLAME, GLASS_ROOM, PIT, STAR, TREE, TREE_GAP, toWorld, type Vec3 } from './blockout'

/**
 * Metres the track's centreline keeps from anything solid. The car's rails reach 0.07 m out and the rider's eye is
 * 0.19 m up (#592), so 0.8 m is still four eye heights, and it fits the ride through the Tree's gap (#613).
 */
export const RAIL_CLEARANCE = 0.8

/** Height of the rails over the Arch's foot: the rider's eye stays under the soffit. */
const ARCH_RAIL_Y = 2.1
/** Height of the rails over the pit floor through the Tree's gap: roughly halfway between the floor's roots and the trunk. */
const GAP_RAIL_Y = 1.75
/** The hairpin in the left cave's mouth: `HAIRPIN_RADIUS` round a centre this far along the Tree from its centre. */
const HAIRPIN_ALONG = -5.6
const HAIRPIN_RADIUS = 2
/** Out from the glass gym room's windows (the hall wall) while passing them. */
const GLASS_STANDOFF = 4.5
/** The spiral's ellipse: this far beyond the Flame's flared footprint along each axis. */
const SPIRAL_MARGIN_X = 2.6
const SPIRAL_MARGIN_Z = 2.8
/** The right turn out of the Arch: tight, so the star is ahead early. */
const TURN_RADIUS = 5.5
/** The crest, where the run-in to the pit begins: out of the turn after the Arch. */
const CREST_Y = 5.2
/** The spiral round the Flame: in at this height, sinking to just over the Flame's top by its last corner, out at `SPIRAL_EXIT_Y`. */
const SPIRAL_TOP_Y = 7
const SPIRAL_EXIT_Y = 4.6

const DEG = Math.PI / 180

/** A point `along` the Tree from its centre and `f` out from its foot line, `y` over the pit floor. */
function treeFrame(along: number, f: number, y: number): Vec3 {
  return {
    x: TREE.centre.x + TREE.along.x * along + TREE.facing.x * f,
    y: PIT.floorY + y,
    z: TREE.centre.z + TREE.along.z * along + TREE.facing.z * f,
  }
}

/** The Tree's gap: `along` its centreline from the trunk's middle, `GAP_RAIL_Y` over the pit floor. */
const GAP_F = (TREE_GAP.minF + TREE_GAP.maxF) / 2
function gap(along: number, y = GAP_RAIL_Y): Vec3 {
  return treeFrame(along, GAP_F, y)
}

/** Round the hairpin in the left cave's mouth: `deg` 0 heading in along the roots' front, 180 heading out along the gap's line. */
function hairpin(deg: number, y: number): Vec3 {
  return treeFrame(HAIRPIN_ALONG - HAIRPIN_RADIUS * Math.sin(deg * DEG), GAP_F + HAIRPIN_RADIUS * (1 + Math.cos(deg * DEG)), y)
}

function spiral(deg: number, y: number): Vec3 {
  const a = FLAME.halfX + SPIRAL_MARGIN_X
  const b = FLAME.halfZ + SPIRAL_MARGIN_Z
  return { x: FLAME.centre.x + a * Math.cos(deg * DEG), y, z: FLAME.centre.z + b * Math.sin(deg * DEG) }
}

/** `axial` along the Arch's passage from its centre (+ = the way it faces), `across` it from the opening's centreline. */
function archLine(axial: number, y: number, across = 0): Vec3 {
  return {
    x: ARCH.centre.x + ARCH.axis.x * axial + ARCH.across.x * across,
    y: ARCH.centre.y + y,
    z: ARCH.centre.z + ARCH.axis.z * axial + ARCH.across.z * across,
  }
}

/** `along` the glass room's window band from its centre, `GLASS_STANDOFF` into the hall. */
function glass(along: number, y: number): Vec3 {
  return {
    x: GLASS_ROOM.centre.x + GLASS_ROOM.along.x * along + GLASS_ROOM.facing.x * GLASS_STANDOFF,
    y,
    z: GLASS_ROOM.centre.z + GLASS_ROOM.along.z * along + GLASS_ROOM.facing.z * GLASS_STANDOFF,
  }
}

/** The right turn out of the Arch's west mouth (+z) to head north (−x): `deg` 0 on the passage's line. */
function turnNorth(deg: number, y: number): Vec3 {
  const start = archLine(ARCH.depth / 2 + 1.6, 0)
  return { x: start.x - TURN_RADIUS + TURN_RADIUS * Math.cos(deg * DEG), y, z: start.z + TURN_RADIUS * Math.sin(deg * DEG) }
}

/** `out` from the star along its facing, `y` over the pit's floor, `side` across the pit (+ = west). */
function pit(out: number, y: number, side: number): Vec3 {
  return { x: STAR.centre.x + STAR.facing.x * out, y: PIT.floorY + y, z: STAR.centre.z + side }
}

/** The control points in blockout metres, from the lap start. */
export function gymControlPoints(): Vec3[] {
  return [
    // 1. The Tree: through the gap under its trunk and up out of the right cave, past its end.
    gap(-0.3),
    gap(2.4),
    treeFrame(6, GAP_F, 2.6),
    treeFrame(9.6, GAP_F, 3.5),
    // 2. Up to the Flame, then a full turn round it, sinking; under the spiral's last corner on the way in.
    { x: 27, y: 3.5, z: 9.5 },
    { x: 34, y: 4.8, z: 12.8 },
    ...[270, 320, 360, 405, 450, 495, 540, 585].map((deg) => spiral(deg, SPIRAL_TOP_Y + (FLAME.top + RAIL_CLEARANCE + 0.1 - SPIRAL_TOP_Y) * ((deg - 270) / 315))),
    spiral(630, SPIRAL_EXIT_Y),
    // 3. South down the east side and through the Arch, westward.
    { x: 58, y: 2.6, z: 13.2 },
    archLine(-ARCH.depth / 2 - 6, ARCH_RAIL_Y, -6),
    archLine(-ARCH.depth / 2 - 1.6, ARCH_RAIL_Y, -0.6),
    archLine(0, ARCH_RAIL_Y),
    archLine(ARCH.depth / 2 + 1.6, ARCH_RAIL_Y),
    // 4. A climbing right turn, heading north, up to the crest by the glass room's windows.
    turnNorth(20, 3.4),
    turnNorth(45, CREST_Y),
    turnNorth(90, CREST_Y - 0.15),
    // 5. The run-in: past the glass room's windows, down the west side, over the pit's rim and down at the star.
    glass(4.5, CREST_Y - 0.3),
    glass(9, CREST_Y - 0.5),
    { x: 46, y: CREST_Y - 0.8, z: 34.1 },
    { x: 36, y: CREST_Y - 1.3, z: 34 },
    { x: 28, y: CREST_Y - 2.2, z: 32 },
    { x: 22, y: CREST_Y - 3.3, z: 30.2 },
    pit(16.5, 3.4, 7.5),
    pit(13.5, 2.5, 5),
    // Rising gently at the star, then (the run over by ~59 s) south clear of the Medusa's bust, west along the roots'
    // front and round the hairpin into the gap.
    pit(11.2, 2.1, 3.6),
    pit(10.3, 2.2, 1.4),
    pit(10.5, 2.3, -1.5),
    pit(11.2, 2.3, -5),
    { x: 11, y: PIT.floorY + 2.2, z: 12.3 },
    treeFrame(-3, 6.4, 2.3),
    ...[0, 45, 90, 135].map((deg) => hairpin(deg, 2.3 - deg / 450)),
    gap(-4, 1.85),
  ]
}

/** The ride in world units. Speeds give a ~63.7 s lap (`lapSeconds`), nearly even: the run's 60 s end turning out of the pit's dive. */
export const GYM_TRACK: TrackParams = {
  curve: 'spline',
  controlPoints: gymControlPoints().map(toWorld),
  // Unused by a spline; scalar 20 gives level 1's structure scale (trackScale 1): a small car in the big hall (#592).
  varA: 0,
  varB: 0,
  varC: 0,
  scalar: 20,
  // Rails, ties and towers sparser than level 1's (still finer per metre ridden): the track is twice as long as the first hall's, under the same triangle budget.
  segments: 800,
  tieSpacing: 22,
  towerSpacing: 300,
  rollerSpeed: 0.0000004,
  minRollerSpeed: 0.000355,
  color1: 0x353d48,
  color2: 0x22d3c5,
}
