import type { EnemyType, WallSurface } from '@/types/level'
import type { ArcTable } from '@/track/arcLength'
import type { HeightFunction } from '@/utils/terrainNoise'
import type { Rng } from '@/utils/rng'
import { maxReadableDistance } from '../enemies/enemyReadability'
import { CLIMB } from '../enemies/climbMotion'

export const WATER_Y = 0
/** Ground below this is sea deep enough to spawn in. */
export const WATER_DEPTH = -5

export type Surface = 'air' | 'ground' | 'water' | 'wall'

/** Uniform over a disc around the origin; `y` is above the terrain, or above `WATER_Y` on water. */
export interface ScatterBand {
  radiusMin: number
  radiusSpan: number
  yMin: number
  ySpan: number
}

export interface EnemyPlacementRule {
  surface: Surface
  /**
   * `'trackside'`: beside the track ahead of the rider (`placeTracksideWave`, #179). `'wall'`: at the foot of one of the
   * level's walls (`wallSlots`), which it climbs (#453).
   */
  scatter: ScatterBand | 'trackside' | 'wall'
}

const band = (radiusMin: number, radiusSpan: number, yMin: number, ySpan = 0): ScatterBand => ({ radiusMin, radiusSpan, yMin, ySpan })

/** The one table of per-enemy placement rules. */
export const ENEMY_PLACEMENT: Record<EnemyType, EnemyPlacementRule> = {
  // Over the park, a little beyond the track (~±1100), so they float close to the ride (#20).
  balloon: { surface: 'air', scatter: band(0, 1700, 40, 160) },
  crow: { surface: 'air', scatter: band(100, 1200, 100, 160) },
  scorpion: { surface: 'ground', scatter: 'trackside' },
  shark: { surface: 'water', scatter: 'trackside' },
  jellyfish: { surface: 'water', scatter: 'trackside' },
  flyingFish: { surface: 'water', scatter: band(100, 1000, 0) },
  snowman: { surface: 'ground', scatter: 'trackside' },
  snowmanScout: { surface: 'ground', scatter: 'trackside' },
  snowmanBrute: { surface: 'ground', scatter: 'trackside' },
  emberWisp: { surface: 'air', scatter: band(200, 2800, 60, 140) },
  lavaGolem: { surface: 'ground', scatter: 'trackside' },
  fireImp: { surface: 'ground', scatter: 'trackside' },
  infernalDrake: { surface: 'air', scatter: band(300, 2600, 150, 100) },
  climber: { surface: 'wall', scatter: 'wall' },
}

export const GOLDEN_BALLOON_SCATTER = band(0, 3000, 50, 100)

export function placedBesideTrack(type: EnemyType): boolean {
  return ENEMY_PLACEMENT[type].scatter === 'trackside'
}

const WATER_SPAWN_ATTEMPTS = 20

/** On water, re-rolled until it is over the sea. */
export function scatterSpawn(b: ScatterBand, surface: Surface, heightFn: HeightFunction, rng: Rng) {
  let x: number
  let z: number
  let attempts = 0
  do {
    const r = Math.sqrt(rng()) * b.radiusSpan + b.radiusMin
    const theta = rng() * 2 * Math.PI
    x = Math.cos(theta) * r
    z = Math.sin(theta) * r
    attempts++
  } while (surface === 'water' && heightFn(x, z) > WATER_DEPTH && attempts < WATER_SPAWN_ATTEMPTS)
  const base = surface === 'water' ? WATER_Y : heightFn(x, z)
  const y = base + b.yMin + (b.ySpan !== 0 ? rng() * b.ySpan : 0)
  return { x, y, z }
}

const READABLE_SPAWN_ATTEMPTS = 30
/** ~256 points around the track. */
const TRACK_DIST_STRIDE = 32

function trackDistSq(p: { x: number; y: number; z: number }, table: ArcTable): number {
  let best = Infinity
  for (let i = 0; i < table.count; i += TRACK_DIST_STRIDE) {
    const dx = table.x[i] - p.x
    const dy = table.y[i] - p.y
    const dz = table.z[i] - p.z
    const d = dx * dx + dy * dy + dz * dz
    if (d < best) best = d
  }
  return best
}

/** A scatter spawn re-rolled until it is within `maxReadableDistance` of the track (#15), else the closest try. */
export function readableScatterSpawn(
  type: EnemyType | 'goldenBalloon',
  b: ScatterBand,
  surface: Surface,
  table: ArcTable,
  heightFn: HeightFunction,
  rng: Rng,
) {
  const maxSq = maxReadableDistance(type) ** 2
  let best = scatterSpawn(b, surface, heightFn, rng)
  let bestSq = trackDistSq(best, table)
  for (let i = 1; i < READABLE_SPAWN_ATTEMPTS && bestSq > maxSq; i++) {
    const p = scatterSpawn(b, surface, heightFn, rng)
    const d = trackDistSq(p, table)
    if (d < bestSq) {
      best = p
      bestSq = d
    }
  }
  return best
}

/** A wall enemy's start: on `wall`, `u` across and `v` up from its bottom-left corner; `seed` picks its route. */
export interface WallSlot {
  wall: WallSurface
  u: number
  v: number
  seed: number
}

/** A wall enemy's origin off the wall's face, world units: its hands and feet on the wall. */
export const WALL_STANDOFF = 11
/** Starts within this fraction of the wall's height from its foot, so a wave doesn't climb in lockstep. */
export const WALL_START_SPREAD = 0.12

/** `start` (0..1): the lowest start as a fraction of the wall's height (`EnemyWave.wallStart`). */
export function wallSlots(count: number, walls: readonly WallSurface[], rng: Rng, start = 0): WallSlot[] {
  if (walls.length === 0) throw new Error("wall enemies need the level's walls (LevelConfig.walls)")
  return Array.from({ length: count }, () => {
    const wall = walls[Math.floor(rng() * walls.length)]
    const margin = Math.min(CLIMB.margin, wall.width / 2)
    return {
      wall,
      u: margin + rng() * (wall.width - 2 * margin),
      v: (start + rng() * WALL_START_SPREAD) * wall.height,
      seed: Math.floor(rng() * 0x7fffffff),
    }
  })
}

type XYZ = { x: number; y: number; z: number }

/** The wall's face direction, `right × up`, into `out`. */
export function wallNormal(wall: WallSurface, out: XYZ = { x: 0, y: 0, z: 0 }): XYZ {
  const { right: r, up: u } = wall
  out.x = r.y * u.z - r.z * u.y
  out.y = r.z * u.x - r.x * u.z
  out.z = r.x * u.y - r.y * u.x
  return out
}

/** The world point `u` across, `v` up and `off` out from the face of `wall`, into `target`. */
export function wallPoint(wall: WallSurface, u: number, v: number, off: number, target: XYZ, normal: XYZ = wallNormal(wall)): XYZ {
  const { origin: o, right: r, up: w } = wall
  target.x = o.x + r.x * u + w.x * v + normal.x * off
  target.y = o.y + r.y * u + w.y * v + normal.y * off
  target.z = o.z + r.z * u + w.z * v + normal.z * off
  return target
}
