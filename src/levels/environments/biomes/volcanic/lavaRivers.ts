import * as THREE from 'three'
import type { HeightFunction } from '@/utils/terrainNoise'
import { safeHeight } from '../../shared/safeHeight'
import { RIVER_CONFIGS, RIVER_SEGMENTS, riverRow } from './lavaRiverPaths'

// The drawn terrain is linear between vertices ~94 units apart, so each row sits
// Y_OFFSET above the max of a 3×3 cell neighbourhood to never clip into it.

const TERRAIN_CELL = 12000 / 128  // ~93.75
const Y_OFFSET = 8

/** Lava rivers — terrain-conforming strips that drape over the heightmap. Caller disposes. */
export function createLavaRiverGeometries(heightFn: HeightFunction): THREE.BufferGeometry[] {
  const geos: THREE.BufferGeometry[] = []
  const half = TERRAIN_CELL * 0.6
  const sh = (x: number, z: number) => safeHeight(heightFn, x, z, half, Y_OFFSET)

  for (const cfg of RIVER_CONFIGS) {
    const positions: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    for (let i = 0; i <= RIVER_SEGMENTS; i++) {
      const t = i / RIVER_SEGMENTS
      const { cx, cz, px, pz } = riverRow(cfg, i)

      const lx = cx + px * cfg.halfWidth
      const lz = cz + pz * cfg.halfWidth
      const rx = cx - px * cfg.halfWidth
      const rz = cz - pz * cfg.halfWidth

      // Use the max of all three sample points so the whole cross-section clears
      const rowY = Math.max(sh(cx, cz), sh(lx, lz), sh(rx, rz))

      positions.push(lx, rowY, lz)
      positions.push(rx, rowY, rz)
      uvs.push(0, t)
      uvs.push(1, t)

      if (i < RIVER_SEGMENTS) {
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
