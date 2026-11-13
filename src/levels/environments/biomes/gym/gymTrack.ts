/**
 * Level 6's ride (#514), pure: a closed spline through the Climbing Gym's blockout, built from its
 * anchors (`blockout.ts`), never from hand-typed world numbers. In ride order from the lap start:
 *
 * 1. Up the Tree's face out of the pit, past its caves into the headwall zone.
 * 2. Over to the Flame and a sinking spiral right round it.
 * 3. South down the east side and west through the Arch.
 * 4. A climbing right turn to the crest by the glass gym room (~39 s).
 * 5. The dive: down the west side and into the Starr pit, the star ahead all the way (the Medusa
 *    rises from it at 40 s); a U-turn under it closes the lap after the run has ended.
 *
 * `gymTrack.test.ts` holds it to the four moments; `scripts/plot-gym-track.mjs` draws it.
 */
import type { TrackParams } from '@/types/level'
import { ARCH, FLAME, GLASS_ROOM, PIT, STAR, TREE, toWorld, type Vec3 } from './blockout'

/** Metres the track's centreline keeps from anything solid: the car (±0.37 m rails) and the rider's eye (0.94 m) fit inside. */
export const RAIL_CLEARANCE = 1.5

/** Height of the rails over the Arch's foot: the rider's eye stays under the soffit. */
const ARCH_RAIL_Y = 2.1
/** Out from the Tree's lip while climbing it. */
const TREE_STANDOFF = 4.5
/** Out from the glass gym room's windows (the hall wall) while passing them. */
const GLASS_STANDOFF = 4.5
/** The spiral's ellipse: this far beyond the Flame's flared footprint along each axis. */
const SPIRAL_MARGIN_X = 3
const SPIRAL_MARGIN_Z = 3.2
/** The right turn out of the Arch: tight, so the star is ahead early. */
const TURN_RADIUS = 5.5
/** The crest, where the run-in to the pit begins: out of the turn after the Arch. */
const CREST_Y = 5.4

const DEG = Math.PI / 180

/** `along` the Tree from its centre, `TREE_STANDOFF` out from its lip. */
function treeFace(along: number, y: number): Vec3 {
  const out = TREE.lip + TREE_STANDOFF
  return {
    x: TREE.centre.x + TREE.along.x * along + TREE.facing.x * out,
    y,
    z: TREE.centre.z + TREE.along.z * along + TREE.facing.z * out,
  }
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
    // 1. The Tree: on its face below the caves' lip, climbing into the headwall zone.
    treeFace(5.5, 4.3),
    treeFace(8.5, 7),
    // 2. Over the pit's rim to the Flame, then a full turn round it, sinking.
    { x: 25, y: 11, z: 14.2 },
    spiral(285, 11.5),
    spiral(320, 11.1),
    spiral(360, 10.6),
    spiral(405, 9.8),
    spiral(450, 9),
    spiral(495, 8.4),
    spiral(540, 7.6),
    spiral(585, 6.4),
    spiral(630, 5),
    // 3. South down the east side and through the Arch, westward.
    { x: 58, y: 2.6, z: 13.2 },
    archLine(-ARCH.depth / 2 - 6, ARCH_RAIL_Y, -6),
    archLine(-ARCH.depth / 2 - 1.6, ARCH_RAIL_Y, -0.6),
    archLine(0, ARCH_RAIL_Y),
    archLine(ARCH.depth / 2 + 1.6, ARCH_RAIL_Y),
    // 4. A climbing right turn to the crest, heading north.
    turnNorth(30, 3.6),
    turnNorth(60, CREST_Y),
    turnNorth(90, CREST_Y - 0.1),
    // 5. The run-in: past the glass room, down the west side, over the pit's rim and down at the star.
    glass(4.5, 5.2),
    glass(9, 5.1),
    { x: 46, y: 5, z: 34.1 },
    { x: 36, y: 4.8, z: 34 },
    { x: 28, y: 4.1, z: 32 },
    { x: 22, y: 2.9, z: 30.2 },
    pit(15.4, 3.3, 7.6),
    pit(11.4, 1.6, 5.6),
    // Rising gently at the star, then (after the run) the U-turn under it, back to the Tree.
    pit(8, 2.1, 3.8),
    pit(5.6, 2.6, 0.6),
    pit(6.3, 3, -3.4),
    pit(9.1, 3.4, -6),
    treeFace(0.5, 1.4),
  ]
}

/** The ride in world units. Speeds give a ~61.5 s lap (`lapSeconds`), nearly even: the run's 60 s end in the pit. */
export const GYM_TRACK: TrackParams = {
  curve: 'spline',
  controlPoints: gymControlPoints().map(toWorld),
  // Unused by a spline; scalar 125 gives the full structure scale (trackScale 2.5).
  varA: 0,
  varB: 0,
  varC: 0,
  scalar: 125,
  rollerSpeed: 0.0000004,
  minRollerSpeed: 0.000348,
  color1: 0x353d48,
  color2: 0x22d3c5,
}
