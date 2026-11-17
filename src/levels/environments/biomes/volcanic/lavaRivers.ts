import * as THREE from 'three'
import type { HeightFunction } from '@/utils/terrainNoise'
import { RIVER_CONFIGS, RIVER_SEGMENTS, riverRow } from './lavaRiverPaths'

/** Vertices across a channel: enough rows of quads that the cross-section bends with the ground. */
export const RIVER_COLUMNS = 6
/** Height over the drawn ground; the channel's material also has a polygon offset. */
const LIFT = 1.5
/** Ground samples per quad edge when lifting a quad over the drawn terrain. */
const QUAD_SAMPLES = 4

/**
 * Lava rivers draped on the terrain as drawn (`groundFn`): a grid of RIVER_COLUMNS quads across
 * each river, every vertex LIFT over the ground, then each quad raised by its worst deficit
 * against the ground inside it (the drawn terrain folds along its own grid, which the quads don't
 * share). UVs as `createLavaMaterial` expects. Caller disposes.
 */
export function createLavaRiverGeometries(groundFn: HeightFunction): THREE.BufferGeometry[] {
  const cols = RIVER_COLUMNS + 1
  return RIVER_CONFIGS.map(cfg => {
    const count = (RIVER_SEGMENTS + 1) * cols
    const position = new Float32Array(count * 3)
    const uv = new Float32Array(count * 2)
    const width = cfg.halfWidth * 2
    let v = 0
    let prevX = 0, prevZ = 0
    for (let i = 0; i <= RIVER_SEGMENTS; i++) {
      const { cx, cz, px, pz } = riverRow(cfg, i)
      if (i > 0) v += Math.hypot(cx - prevX, cz - prevZ) / width
      prevX = cx; prevZ = cz
      for (let j = 0; j < cols; j++) {
        const u = j / RIVER_COLUMNS
        const off = (u - 0.5) * width
        const x = cx + px * off
        const z = cz + pz * off
        const k = i * cols + j
        position.set([x, groundFn(x, z) + LIFT, z], k * 3)
        uv.set([u, v], k * 2)
      }
    }

    const index: number[] = []
    const lift = new Float32Array(count)
    const p = (k: number, c: number) => position[k * 3 + c]
    for (let i = 0; i < RIVER_SEGMENTS; i++) {
      for (let j = 0; j < RIVER_COLUMNS; j++) {
        const a = i * cols + j
        const b = a + 1
        const d = a + cols
        const e = d + 1
        index.push(a, d, b, b, d, e)
        // Worst deficit of each triangle (abd, bde) against the drawn ground, sampled over it.
        let lowAbd = 0
        let lowBde = 0
        for (let q = 0; q <= QUAD_SAMPLES; q++) {
          for (let s = 0; s <= QUAD_SAMPLES - q; s++) {
            const fs = s / QUAD_SAMPLES
            const ft = q / QUAD_SAMPLES
            const over = (o: number, m: number, n: number) => {
              const x = p(o, 0) + fs * (p(m, 0) - p(o, 0)) + ft * (p(n, 0) - p(o, 0))
              const z = p(o, 2) + fs * (p(m, 2) - p(o, 2)) + ft * (p(n, 2) - p(o, 2))
              const y = p(o, 1) + fs * (p(m, 1) - p(o, 1)) + ft * (p(n, 1) - p(o, 1))
              return groundFn(x, z) + LIFT - y
            }
            lowAbd = Math.max(lowAbd, over(a, b, d))
            lowBde = Math.max(lowBde, over(e, d, b))
          }
        }
        const both = Math.max(lowAbd, lowBde)
        lift[a] = Math.max(lift[a], lowAbd)
        lift[b] = Math.max(lift[b], both)
        lift[d] = Math.max(lift[d], both)
        lift[e] = Math.max(lift[e], lowBde)
      }
    }
    for (let k = 0; k < count; k++) position[k * 3 + 1] += lift[k]

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(position, 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    geo.setIndex(index)
    geo.computeBoundingSphere()
    return geo
  })
}
