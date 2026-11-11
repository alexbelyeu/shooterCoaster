/**
 * The Climbing Gym's hall (#457), pure: its box sized round level6's track (`hall.test.ts` holds the track inside
 * it), the four walls, and the sport lanes the climbers climb (`GYM_WALLS`, the level's `LevelConfig.walls`).
 * World units; the floor is y = 0 (`terrainNoise.ts` `gym`: flat).
 */
import type { WallSurface } from '@/types/level'

/** Inner faces of the walls. level6's track spans x ±885, z -975..548, y 134..636: ≥ 115 clear on every side. */
export const HALL = { minX: -1000, maxX: 1000, minZ: -1100, maxZ: 680 } as const
export const CEILING_Y = 1000
/** The lanes end under the catwalk that runs round the hall: a climber that reaches it tops out. */
export const SPORT_HEIGHT = 700
/** Arêtes between lanes and at the corners: a triangular prism this wide at the wall, standing this far out. */
export const ARETE_WIDTH = 60
export const ARETE_DEPTH = 45
const LANE_TARGET = 420

type V3 = { x: number; y: number; z: number }

/** One wall's inner face: from `origin` (its floor corner) along `right` for `length`; it faces `normal`, into the hall. */
export interface HallWall {
  id: string
  origin: V3
  right: V3
  normal: V3
  length: number
}

const xLen = HALL.maxX - HALL.minX
const zLen = HALL.maxZ - HALL.minZ

/** right × up = normal, so each `WallSurface` faces into the hall (`wallNormal`). */
export const HALL_WALLS: readonly HallWall[] = [
  { id: 'south', origin: { x: HALL.minX, y: 0, z: HALL.minZ }, right: { x: 1, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 }, length: xLen },
  { id: 'east', origin: { x: HALL.maxX, y: 0, z: HALL.minZ }, right: { x: 0, y: 0, z: 1 }, normal: { x: -1, y: 0, z: 0 }, length: zLen },
  { id: 'north', origin: { x: HALL.maxX, y: 0, z: HALL.maxZ }, right: { x: -1, y: 0, z: 0 }, normal: { x: 0, y: 0, z: -1 }, length: xLen },
  { id: 'west', origin: { x: HALL.minX, y: 0, z: HALL.maxZ }, right: { x: 0, y: 0, z: -1 }, normal: { x: 1, y: 0, z: 0 }, length: zLen },
]

/** A sport lane: `u0`..`u1` along its wall, between two arêtes. */
export interface Lane {
  wall: HallWall
  index: number
  u0: number
  u1: number
}

/** Each wall split into lanes of about `LANE_TARGET`, an arête at both corners and between every two. */
export function wallLanes(wall: HallWall): Lane[] {
  const n = Math.max(1, Math.round((wall.length - ARETE_WIDTH) / (LANE_TARGET + ARETE_WIDTH)))
  const width = (wall.length - (n + 1) * ARETE_WIDTH) / n
  return Array.from({ length: n }, (_, index) => {
    const u0 = ARETE_WIDTH + index * (width + ARETE_WIDTH)
    return { wall, index, u0, u1: u0 + width }
  })
}

export const LANES: readonly Lane[] = HALL_WALLS.flatMap(wallLanes)

/** Arête centres along a wall (`u`): both corners and every lane boundary. */
export function aretePositions(wall: HallWall): number[] {
  const lanes = wallLanes(wall)
  return [ARETE_WIDTH / 2, ...lanes.map((l) => l.u1 + ARETE_WIDTH / 2)]
}

/** The world point `u` along and `v` up `wall`, `out` off its face. */
export function hallPoint(wall: HallWall, u: number, v: number, out = 0): V3 {
  const { origin: o, right: r, normal: n } = wall
  return { x: o.x + r.x * u + n.x * out, y: o.y + v, z: o.z + r.z * u + n.z * out }
}

/** Every lane as a climbable wall, up to the catwalk. */
export const GYM_WALLS: WallSurface[] = LANES.map((lane) => ({
  id: `${lane.wall.id}-${lane.index}`,
  origin: hallPoint(lane.wall, lane.u0, 0),
  right: { ...lane.wall.right },
  up: { x: 0, y: 1, z: 0 },
  width: lane.u1 - lane.u0,
  height: SPORT_HEIGHT,
}))
