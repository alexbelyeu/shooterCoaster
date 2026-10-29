/** Lava river layout shared by the strips (`lavaRivers.ts`) and the ground glow (`lavaGlow.ts`). */

export interface LavaRiverConfig {
  angle: number
  rStart: number
  rEnd: number
  halfWidth: number
}

export const RIVER_CONFIGS: readonly LavaRiverConfig[] = [
  { angle: 0.3, rStart: 800, rEnd: 3000, halfWidth: 30 },
  { angle: 1.2, rStart: 900, rEnd: 2800, halfWidth: 24 },
  { angle: 2.5, rStart: 1000, rEnd: 3200, halfWidth: 34 },
  { angle: 3.8, rStart: 700, rEnd: 2600, halfWidth: 28 },
  { angle: 5.0, rStart: 850, rEnd: 2900, halfWidth: 32 },
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
  const dx = Math.cos(cfg.angle)
  const dz = Math.sin(cfg.angle)
  const px = -dz
  const pz = dx
  const r = cfg.rStart + (cfg.rEnd - cfg.rStart) * t
  const wander = Math.sin(t * 4) * 30 + Math.cos(t * 7) * 15
  return { cx: dx * r + px * wander, cz: dz * r + pz * wander, px, pz }
}
