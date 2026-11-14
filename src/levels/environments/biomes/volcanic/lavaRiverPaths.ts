import { getTerrainMeshSize, TERRAIN_MESH_SEGMENTS } from '@/utils/terrainNoise'

/** Lava river layout shared by the channels (`lavaRivers.ts`), the ground glow (`lavaGlow.ts`) and the Magma Titan's river spots. */

/** Spacing of the drawn volcanic terrain grid (~94 units): the drawn ground is linear in between. */
export const TERRAIN_CELL = getTerrainMeshSize('volcanic') / TERRAIN_MESH_SEGMENTS

/**
 * A river is an arc round the track's centre: it starts `rStart` out at `angle` and turns through
 * `bend` radians while drifting out to `rEnd`. Arcs cross the ride's spokes (the track runs
 * out from and back to the centre on every lobe); a radial river lay along a spoke, and from the
 * coaster it stood up the middle of the view as a glowing wall (#331, `lavaRivers.test.ts`).
 */
export interface LavaRiverConfig {
  angle: number
  bend: number
  rStart: number
  rEnd: number
  halfWidth: number
}

export const RIVER_CONFIGS: readonly LavaRiverConfig[] = [
  { angle: 0.0, bend: 1, rStart: 1300, rEnd: 1700, halfWidth: 60 },
  { angle: 2.45, bend: -1, rStart: 1300, rEnd: 1700, halfWidth: 50 },
  { angle: 2.8, bend: 1, rStart: 1200, rEnd: 2000, halfWidth: 66 },
  { angle: 4.9, bend: -1, rStart: 1000, rEnd: 1400, halfWidth: 56 },
  { angle: 5.25, bend: 1, rStart: 1200, rEnd: 2000, halfWidth: 64 },
]

export const RIVER_SEGMENTS = 120

export interface RiverRow {
  cx: number
  cz: number
  /** Unit perpendicular to the flow. */
  px: number
  pz: number
}

/** Centre of row `i` (0..RIVER_SEGMENTS), including the river's sideways wander. */
export function riverRow(cfg: LavaRiverConfig, i: number): RiverRow {
  const t = i / RIVER_SEGMENTS
  const a = cfg.angle + cfg.bend * t
  const ca = Math.cos(a)
  const sa = Math.sin(a)
  const dr = cfg.rEnd - cfg.rStart
  const r = cfg.rStart + dr * t
  // Tangent of the arc (d/dt), then its left-hand perpendicular.
  const tx = dr * ca - r * cfg.bend * sa
  const tz = dr * sa + r * cfg.bend * ca
  const tl = Math.hypot(tx, tz)
  const px = -tz / tl
  const pz = tx / tl
  const wander = Math.sin(t * 4) * 30 + Math.cos(t * 7) * 15
  return { cx: ca * r + px * wander, cz: sa * r + pz * wander, px, pz }
}
