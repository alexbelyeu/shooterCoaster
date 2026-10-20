import * as THREE from 'three'
import type { HeightFunction } from '@/utils/terrainNoise'
import { safeHeight } from '../../shared/safeHeight'

const RIVER_CONFIGS = [
  { angle: 0.3, rStart: 800, rEnd: 3000, halfWidth: 15 },
  { angle: 1.2, rStart: 900, rEnd: 2800, halfWidth: 12 },
  { angle: 2.5, rStart: 1000, rEnd: 3200, halfWidth: 18 },
  { angle: 3.8, rStart: 700, rEnd: 2600, halfWidth: 14 },
  { angle: 5.0, rStart: 850, rEnd: 2900, halfWidth: 16 },
]

// The terrain mesh is 128 segments over 12000 units (~94 units/cell).
// Between terrain vertices the GPU interpolates linearly, but heightFn
// gives exact noise.  To guarantee the lava strip always sits visibly
// *above* the rendered terrain surface we:
//  1. Sample a 3×3 grid around each vertex (matching the terrain cell size)
//     and take the MAX height so we clear any nearby peak.
//  2. Add a generous Y offset (8 units).
//  3. Use 120 segments so the strip follows the terrain closely.

const TERRAIN_CELL = 12000 / 128  // ~93.75
const Y_OFFSET = 8
const SEGMENTS = 120

/** Lava rivers — terrain-conforming strips that drape over the heightmap. Caller disposes. */
export function createLavaRiverGeometries(heightFn: HeightFunction): THREE.BufferGeometry[] {
  const geos: THREE.BufferGeometry[] = []
  const half = TERRAIN_CELL * 0.6
  const sh = (x: number, z: number) => safeHeight(heightFn, x, z, half, Y_OFFSET)

  for (const cfg of RIVER_CONFIGS) {
    const dx = Math.cos(cfg.angle)
    const dz = Math.sin(cfg.angle)
    const px = -dz // perpendicular
    const pz = dx

    const positions: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    for (let i = 0; i <= SEGMENTS; i++) {
      const t = i / SEGMENTS
      const r = cfg.rStart + (cfg.rEnd - cfg.rStart) * t
      const cx = dx * r
      const cz = dz * r
      const wander = Math.sin(t * 4) * 30 + Math.cos(t * 7) * 15

      const lx = cx + (px * cfg.halfWidth) + px * wander
      const lz = cz + (pz * cfg.halfWidth) + pz * wander
      const rx = cx - (px * cfg.halfWidth) + px * wander
      const rz = cz - (pz * cfg.halfWidth) + pz * wander

      // Use the max of all three sample points so the whole cross-section clears
      const centerH = sh(cx + px * wander, cz + pz * wander)
      const leftH = sh(lx, lz)
      const rightH = sh(rx, rz)
      const rowY = Math.max(centerH, leftH, rightH)

      positions.push(lx, rowY, lz)
      positions.push(rx, rowY, rz)
      uvs.push(0, t)
      uvs.push(1, t)

      if (i < SEGMENTS) {
        const base = i * 2
        indices.push(base, base + 1, base + 2)
        indices.push(base + 1, base + 3, base + 2)
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geo.setIndex(indices)
    geo.computeVertexNormals()
    geos.push(geo)
  }
  return geos
}
