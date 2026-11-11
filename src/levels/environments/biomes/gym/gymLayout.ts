/**
 * Where the gym's props go (#457), pure and seeded so the hall is the same every visit: holds in coloured
 * routes up every lane, volumes bolted between them, and the bouldering zone (boulders on mats) on the
 * floor clear of the track and its towers.
 */
import type { ArcTable } from '@/track/arcLength'
import { createRng, type Rng } from '@/utils/rng'
import { buildTrackIndex } from '../../shared/trackClearance'
import { HALL, LANES, SPORT_HEIGHT, hallPoint, type Lane } from './hall'

/** The setters' tape colours: a route is one colour, top to bottom. */
export const ROUTE_COLORS = ['#ff3355', '#ffb300', '#22c55e', '#1e88ff', '#a855f7', '#ff6fc1'] as const
export const HOLD_SHAPES = 4

export interface Hold {
  x: number
  y: number
  z: number
  /** Turns the hold's +z onto the wall's normal. */
  yaw: number
  /** Spin about the wall normal. */
  roll: number
  scale: number
  shape: number
  color: string
}

export interface Volume {
  x: number
  y: number
  z: number
  yaw: number
  roll: number
  size: number
  /** 3 = a triangle, 6 = a hexagon. */
  sides: 3 | 6
  color: string
}

const ROUTE_SPACING = 105
const HOLD_STEP = [38, 56] as const
/** A route's start tag: the tape strip at its foot. */
export interface RouteTag {
  x: number
  y: number
  z: number
  yaw: number
  color: string
}

const yawOf = (lane: Lane) => Math.atan2(lane.wall.normal.x, lane.wall.normal.z)

function laneRoutes(lane: Lane, rng: Rng, holds: Hold[], tags: RouteTag[]) {
  const width = lane.u1 - lane.u0
  const count = Math.max(1, Math.floor(width / ROUTE_SPACING))
  const yaw = yawOf(lane)
  let colour = Math.floor(rng() * ROUTE_COLORS.length)
  for (let r = 0; r < count; r++) {
    // Neighbouring routes never share a colour.
    colour = (colour + 1 + Math.floor(rng() * (ROUTE_COLORS.length - 1))) % ROUTE_COLORS.length
    const color = ROUTE_COLORS[colour]
    const centre = lane.u0 + ((r + 0.5) * width) / count
    tags.push({ ...hallPoint(lane.wall, centre, 14, 1), yaw, color })
    for (let v = 40 + rng() * 20; v < SPORT_HEIGHT - 20; v += HOLD_STEP[0] + rng() * (HOLD_STEP[1] - HOLD_STEP[0])) {
      const u = centre + (rng() - 0.5) * 50
      holds.push({
        ...hallPoint(lane.wall, u, v, 0),
        yaw,
        roll: rng() * Math.PI * 2,
        scale: 0.8 + rng() * 0.6,
        shape: Math.floor(rng() * HOLD_SHAPES),
        color,
      })
    }
  }
}

function laneVolumes(lane: Lane, rng: Rng, volumes: Volume[]) {
  const yaw = yawOf(lane)
  for (let k = 0; k < 2; k++) {
    const size = 60 + rng() * 60
    const u = lane.u0 + size + rng() * Math.max(0, lane.u1 - lane.u0 - 2 * size)
    const v = 140 + k * 250 + rng() * 120
    volumes.push({
      ...hallPoint(lane.wall, u, v, 0),
      yaw,
      roll: rng() * Math.PI,
      size,
      sides: rng() < 0.5 ? 3 : 6,
      color: ROUTE_COLORS[Math.floor(rng() * ROUTE_COLORS.length)],
    })
  }
}

export interface WallDressing {
  holds: Hold[]
  volumes: Volume[]
  tags: RouteTag[]
}

export function wallDressing(seed: number): WallDressing {
  const rng = createRng(seed)
  const holds: Hold[] = []
  const volumes: Volume[] = []
  const tags: RouteTag[] = []
  for (const lane of LANES) {
    laneVolumes(lane, rng, volumes)
    laneRoutes(lane, rng, holds, tags)
  }
  return { holds, volumes, tags }
}

export interface Boulder {
  x: number
  z: number
  /** Footprint radius; its mat reaches `MAT_MARGIN` further. */
  radius: number
  height: number
  yaw: number
  color: string
}

export const MAT_MARGIN = 70
/** Kept this far (XZ) from the track: its towers stand under it. */
const TRACK_CLEARANCE = 60
const WALL_CLEARANCE = 160
const MAX_BOULDERS = 6

/** The bouldering zone: big faceted blocks on blue mats, wherever the floor is clear of the track. */
export function boulderSpots(track: ArcTable, seed: number): Boulder[] {
  const rng = createRng(seed)
  const index = buildTrackIndex(track)
  const out: Boulder[] = []
  for (let attempt = 0; attempt < 400 && out.length < MAX_BOULDERS; attempt++) {
    const radius = 90 + rng() * 70
    const reach = radius + MAT_MARGIN
    const x = HALL.minX + WALL_CLEARANCE + reach + rng() * (HALL.maxX - HALL.minX - 2 * (WALL_CLEARANCE + reach))
    const z = HALL.minZ + WALL_CLEARANCE + reach + rng() * (HALL.maxZ - HALL.minZ - 2 * (WALL_CLEARANCE + reach))
    if (index.near(x, z, reach + TRACK_CLEARANCE)) continue
    if (out.some((b) => Math.hypot(b.x - x, b.z - z) < b.radius + radius + 2 * MAT_MARGIN)) continue
    out.push({
      x,
      z,
      radius,
      height: 110 + rng() * 90,
      yaw: rng() * Math.PI * 2,
      color: ROUTE_COLORS[Math.floor(rng() * ROUTE_COLORS.length)],
    })
  }
  return out
}
