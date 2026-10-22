import { RIVER_CONFIGS, RIVER_SEGMENTS, riverRow, type LavaRiverConfig } from './lavaRiverPaths'

/** Wider than the lava's own glow would be: the terrain grid is ~94 units, so a 60-unit band would miss most vertices. */
export const GLOW_RADIUS = 140

interface RiverPolyline {
  halfWidth: number
  xs: Float64Array
  zs: Float64Array
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

function polyline(cfg: LavaRiverConfig, reach: number): RiverPolyline {
  const n = RIVER_SEGMENTS + 1
  const xs = new Float64Array(n)
  const zs = new Float64Array(n)
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (let i = 0; i < n; i++) {
    const { cx, cz } = riverRow(cfg, i)
    xs[i] = cx
    zs[i] = cz
    minX = Math.min(minX, cx); maxX = Math.max(maxX, cx)
    minZ = Math.min(minZ, cz); maxZ = Math.max(maxZ, cz)
  }
  return { halfWidth: cfg.halfWidth, xs, zs, minX: minX - reach, maxX: maxX + reach, minZ: minZ - reach, maxZ: maxZ + reach }
}

function distanceToPolyline(p: RiverPolyline, x: number, z: number): number {
  let best = Infinity
  for (let i = 0; i < p.xs.length - 1; i++) {
    const ax = p.xs[i], az = p.zs[i]
    const sx = p.xs[i + 1] - ax, sz = p.zs[i + 1] - az
    const len2 = sx * sx + sz * sz
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * sx + (z - az) * sz) / len2)) : 0
    const dx = x - (ax + sx * t)
    const dz = z - (az + sz * t)
    const d2 = dx * dx + dz * dz
    if (d2 < best) best = d2
  }
  return Math.sqrt(best)
}

/** 0..1 glow at (x, z): 1 at a river's edge and under it, 0 from GLOW_RADIUS beyond the edge. */
export function createLavaGlowSampler(
  rivers: readonly LavaRiverConfig[] = RIVER_CONFIGS,
  radius = GLOW_RADIUS,
): (x: number, z: number) => number {
  const lines = rivers.map(cfg => polyline(cfg, cfg.halfWidth + radius))
  return (x, z) => {
    let glow = 0
    for (const line of lines) {
      if (x < line.minX || x > line.maxX || z < line.minZ || z > line.maxZ) continue
      const edge = distanceToPolyline(line, x, z) - line.halfWidth
      const f = 1 - Math.max(0, Math.min(1, edge / radius))
      glow = Math.max(glow, f * f)
    }
    return glow
  }
}
