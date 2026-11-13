/**
 * Alex's blockout of the Climbing Gym (#513), read as typed pieces (pure). `blockout.json` is his file
 * verbatim; its format is in `docs/levels/README.md`. Everything here is in the blockout's metres:
 * `x` along the hall (0 at the Starr end), `z` across (0 on the east side), `y` up (0 the main floor).
 * `toWorld` scales it to the level, uniformly by `GYM_SCALE` with the hall's centre at the origin.
 */
import data from './blockout.json'

/** World units per metre: the 80 m hall becomes 1280 units long, the size of today's tracks (≈ 1000–1600). */
export const GYM_SCALE = 16

export interface Panel {
  len: number
  /** Degrees from vertical: + overhangs toward the climber, − is a slab. */
  angle: number
}

interface PieceBase {
  id: string
  name: string
  x: number
  z: number
  /** Degrees; the piece faces local +z (0 → +z, 90 → +x). */
  rot: number
  /** y of its foot (0 when the file leaves it out). */
  base: number
  note?: string
}

export type BlockoutPiece = PieceBase &
  (
    | { kind: 'sport' | 'boulder'; length: number; profile: Panel[]; back?: number; ropes?: number; color?: string }
    | { kind: 'tree'; width: number; trunk: number; caveDepth: number; caveHeight: number; height: number; headAngle: number; color?: string }
    | { kind: 'block'; w: number; d: number; chamfer: number; profile: Panel[]; color?: string; colorB?: string; color2?: string; colorB2?: string }
    | { kind: 'arch'; length: number; d: number; height: number; opening: number; openingHeight: number; flare: number; attached: boolean; color?: string }
    | { kind: 'star'; points: number; radius: number; inner: number; depth: number; colorA: string; colorB: string }
    | { kind: 'pit'; w: number; d: number; depth: number }
    | { kind: 'stairs'; w: number; steps: number; rise: number; run: number }
    | { kind: 'floor'; w: number; d: number }
    | { kind: 'pad'; w: number; d: number; thick: number; color?: string }
    | { kind: 'prop'; w: number; d: number; h: number; color?: string }
    | { kind: 'windows'; length: number; count: number; winW: number; h: number }
    | { kind: 'autobelay' }
  )

export type PieceKind = BlockoutPiece['kind']
export type PieceOf<K extends PieceKind> = Extract<BlockoutPiece, { kind: K }>

export const HALL: { w: number; d: number; h: number } = data.hall

export const PIECES: readonly BlockoutPiece[] = data.items.map((item) => ({ base: 0, ...item }) as BlockoutPiece)

export function piece<K extends PieceKind>(kind: K, id?: string): PieceOf<K> {
  const found = PIECES.find((p) => p.kind === kind && (id === undefined || p.id === id))
  if (!found) throw new Error(`blockout has no ${kind}${id ? ` "${id}"` : ''}`)
  return found as PieceOf<K>
}

export interface Vec3 {
  x: number
  y: number
  z: number
}

/** Blockout metres → world units. */
export function toWorld(p: Vec3): Vec3 {
  return { x: (p.x - HALL.w / 2) * GYM_SCALE, y: p.y * GYM_SCALE, z: (p.z - HALL.d / 2) * GYM_SCALE }
}

/** World units → blockout metres. */
export function toBlockout(p: Vec3): Vec3 {
  return { x: p.x / GYM_SCALE + HALL.w / 2, y: p.y / GYM_SCALE, z: p.z / GYM_SCALE + HALL.d / 2 }
}

const DEG = Math.PI / 180

/** Unit vectors of a piece's local x (along it) and z (the way it faces), in the blockout's x/z. */
export function pieceAxes(rot: number): { along: { x: number; z: number }; facing: { x: number; z: number } } {
  const r = rot * DEG
  return { along: { x: Math.cos(r), z: -Math.sin(r) }, facing: { x: Math.sin(r), z: Math.cos(r) } }
}

/** A piece's local (along, facing) offset → blockout x/z. */
export function pieceToBlockout(p: Pick<PieceBase, 'x' | 'z' | 'rot'>, along: number, facing: number): { x: number; z: number } {
  const a = pieceAxes(p.rot)
  return { x: p.x + a.along.x * along + a.facing.x * facing, z: p.z + a.along.z * along + a.facing.z * facing }
}

/** A box in a piece's frame: `minA..maxA` along it, `minF..maxF` the way it faces, `minY..maxY` up. */
export interface OrientedBox {
  id: string
  x: number
  z: number
  rot: number
  minA: number
  maxA: number
  minF: number
  maxF: number
  minY: number
  maxY: number
}

/** Shortest distance from a blockout point to a box (0 inside). */
export function distanceToBox(box: OrientedBox, p: Vec3): number {
  const a = pieceAxes(box.rot)
  const dx = p.x - box.x
  const dz = p.z - box.z
  const along = dx * a.along.x + dz * a.along.z
  const facing = dx * a.facing.x + dz * a.facing.z
  const ea = Math.max(box.minA - along, 0, along - box.maxA)
  const ef = Math.max(box.minF - facing, 0, facing - box.maxF)
  const ey = Math.max(box.minY - p.y, 0, p.y - box.maxY)
  return Math.hypot(ea, ef, ey)
}

/** Height and how far a profile reaches forward (+, overhang) and back (−, slab) of its foot. */
export function profileExtent(profile: readonly Panel[]): { height: number; forward: number; backward: number } {
  let y = 0
  let f = 0
  let forward = 0
  let backward = 0
  for (const panel of profile) {
    y += panel.len * Math.cos(panel.angle * DEG)
    f += panel.len * Math.sin(panel.angle * DEG)
    forward = Math.max(forward, f)
    backward = Math.min(backward, f)
  }
  return { height: y, forward, backward: -backward }
}

/** Depth behind a wall's face when the file gives none, and a floor slab's thickness. */
const DEFAULT_BACK = 0.5
const SLAB_THICKNESS = 0.3

/** How far the tree's headwall leans out past the caves' lip, at its top. */
export function treeHeadLean(t: PieceOf<'tree'>): number {
  return (t.height - t.caveHeight) * Math.tan(t.headAngle * DEG)
}

/**
 * The solid volume of every piece as boxes (conservative: a wall's box holds its whole profile).
 * Windows, auto belays and the pit hold no volume; the Arch is its legs and lintel, its round-topped
 * opening left clear (`ARCH` measures that).
 */
export function pieceBoxes(p: BlockoutPiece): OrientedBox[] {
  const box = (minA: number, maxA: number, minF: number, maxF: number, minY: number, maxY: number, suffix = ''): OrientedBox => ({
    id: p.id + suffix,
    x: p.x,
    z: p.z,
    rot: p.rot,
    minA,
    maxA,
    minF,
    maxF,
    minY,
    maxY,
  })
  const b = p.base
  switch (p.kind) {
    case 'sport':
    case 'boulder': {
      const e = profileExtent(p.profile)
      return [box(-p.length / 2, p.length / 2, -(p.back ?? DEFAULT_BACK) - e.backward, e.forward, b, b + e.height)]
    }
    case 'tree':
      return [box(-p.width / 2, p.width / 2, -DEFAULT_BACK, p.caveDepth + treeHeadLean(p), b, b + p.height)]
    case 'block': {
      const e = profileExtent(p.profile)
      return [box(-p.w / 2 - e.forward, p.w / 2 + e.forward, -p.d / 2 - e.forward, p.d / 2 + e.forward, b, b + e.height)]
    }
    case 'arch': {
      const half = p.d / 2 + p.flare
      const o = p.opening / 2
      return [
        box(-p.length / 2, -o, -half, half, b, b + p.height, ':leg-'),
        box(o, p.length / 2, -half, half, b, b + p.height, ':leg+'),
        box(-o, o, -half, half, b + p.openingHeight, b + p.height, ':lintel'),
      ]
    }
    case 'star':
      return [box(-p.radius, p.radius, 0, p.depth, b - p.radius, b + p.radius)]
    case 'stairs':
      return [box(-p.w / 2, p.w / 2, 0, p.steps * p.run, b - p.steps * p.rise, b)]
    case 'floor':
      return [box(-p.w / 2, p.w / 2, -p.d / 2, p.d / 2, b - SLAB_THICKNESS, b)]
    case 'pad':
      return [box(-p.w / 2, p.w / 2, -p.d / 2, p.d / 2, b, b + p.thick)]
    case 'prop':
      return [box(-p.w / 2, p.w / 2, -p.d / 2, p.d / 2, b, b + p.h)]
    case 'pit':
    case 'windows':
    case 'autobelay':
      return []
  }
}

export const BLOCKOUT_BOXES: readonly OrientedBox[] = PIECES.flatMap(pieceBoxes)

// ---- Named anchors: what the track, spawns and the boss are built round. ----

const pit = piece('pit')
/** The sunken Starr pit (a rectangle in x/z) and its floor. */
export const PIT = {
  minX: pit.x - pit.w / 2,
  maxX: pit.x + pit.w / 2,
  minZ: pit.z - pit.d / 2,
  maxZ: pit.z + pit.d / 2,
  floorY: pit.base - pit.depth,
}

/** Floor height at a blockout x/z: the pit's floor inside it, the main floor elsewhere. */
export function floorAt(x: number, z: number): number {
  return x >= PIT.minX && x <= PIT.maxX && z >= PIT.minZ && z <= PIT.maxZ ? PIT.floorY : 0
}

const star = piece('star')
/** The Starr: its centre on the end wall, the way it faces, and the plane of its front. */
export const STAR = {
  centre: { x: star.x, y: star.base, z: star.z },
  facing: pieceAxes(star.rot).facing,
  radius: star.radius,
  depth: star.depth,
}

const arch = piece('arch')
const archAxes = pieceAxes(arch.rot)
/** The Arch's round-topped opening: centre of its foot, size, and the passage axis through it. */
export const ARCH = {
  centre: { x: arch.x, y: arch.base, z: arch.z },
  width: arch.opening,
  height: arch.openingHeight,
  /** Through the passage (the piece's facing) and across it. */
  axis: archAxes.facing,
  across: archAxes.along,
  /** Passage length, both flares included. */
  depth: arch.d + 2 * arch.flare,
}

/**
 * Clearance from a blockout point inside the Arch's passage to its opening's edge (legs and the
 * round soffit: straight sides up to `height − width / 2`, a half circle above); negative outside it.
 */
export function archOpeningClearance(p: Vec3): number {
  const dx = p.x - ARCH.centre.x
  const dz = p.z - ARCH.centre.z
  const u = dx * ARCH.across.x + dz * ARCH.across.z
  const v = p.y - ARCH.centre.y
  const r = ARCH.width / 2
  const springY = ARCH.height - r
  if (v <= springY) return Math.min(r - Math.abs(u), v)
  return Math.min(r - Math.hypot(u, v - springY), v)
}

/** Distance along the Arch's passage axis from its centre plane. */
export function archAxial(p: Vec3): number {
  return (p.x - ARCH.centre.x) * ARCH.axis.x + (p.z - ARCH.centre.z) * ARCH.axis.z
}

const flame = PIECES.find((p): p is PieceOf<'block'> => p.kind === 'block' && p.name === 'Flame')
if (!flame) throw new Error('blockout has no Flame')
const flameBox = pieceBoxes(flame)[0]
/** The Flame boulder: centre, its flared footprint (half sizes along x/z at rot 0) and top. */
export const FLAME = {
  centre: { x: flame.x, z: flame.z },
  box: flameBox,
  halfX: flameBox.maxA,
  halfZ: flameBox.maxF,
  top: flameBox.maxY,
}

const tree = piece('tree')
const treeAxes = pieceAxes(tree.rot)
/** The Tree's face: along it from its centre, the way it faces, the caves' lip and the headwall above. */
export const TREE = {
  centre: { x: tree.x, z: tree.z },
  along: treeAxes.along,
  facing: treeAxes.facing,
  width: tree.width,
  trunk: tree.trunk,
  /** The face's lip (trunk front / cave roofs meet) out from the piece's foot line. */
  lip: tree.caveDepth,
  caveTopY: tree.base + tree.caveHeight,
  headTopY: tree.base + tree.height,
  headLean: treeHeadLean(tree),
}

/** How far a blockout point stands out from the Tree's face at its height (the headwall leans out). */
export function treeFaceDistance(p: Vec3): number {
  const facing = (p.x - TREE.centre.x) * TREE.facing.x + (p.z - TREE.centre.z) * TREE.facing.z
  const above = Math.min(Math.max(p.y - TREE.caveTopY, 0), TREE.headTopY - TREE.caveTopY)
  return facing - TREE.lip - (above / (TREE.headTopY - TREE.caveTopY)) * TREE.headLean
}

/** Along the Tree from its centre. */
export function treeAlong(p: Vec3): number {
  return (p.x - TREE.centre.x) * TREE.along.x + (p.z - TREE.centre.z) * TREE.along.z
}

const glass = piece('windows', 'win-glassgym')
const glassAxes = pieceAxes(glass.rot)
/** The glass gym room's window band on the hall's west wall, facing into the hall. */
export const GLASS_ROOM = {
  centre: { x: glass.x, z: glass.z },
  along: glassAxes.along,
  facing: glassAxes.facing,
  length: glass.length,
  minY: glass.base,
  maxY: glass.base + glass.h,
}

/** Distance from a blockout point to the window band (a rectangle on the wall). */
export function glassDistance(p: Vec3): number {
  const dx = p.x - GLASS_ROOM.centre.x
  const dz = p.z - GLASS_ROOM.centre.z
  const along = dx * GLASS_ROOM.along.x + dz * GLASS_ROOM.along.z
  const out = dx * GLASS_ROOM.facing.x + dz * GLASS_ROOM.facing.z
  const ea = Math.max(Math.abs(along) - GLASS_ROOM.length / 2, 0)
  const ey = Math.max(GLASS_ROOM.minY - p.y, 0, p.y - GLASS_ROOM.maxY)
  return Math.hypot(ea, out, ey)
}
