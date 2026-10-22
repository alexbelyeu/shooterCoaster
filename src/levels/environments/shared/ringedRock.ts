import * as THREE from 'three'
import { createRng } from './trackScatter'

/** Rock formations built as a stack of jittered rings (sea stacks, mesas), heights baked in. */

/** One ring of a rock profile at scale 1. Two rings at the same y make a ledge. */
export interface RockRing {
  y: number
  r: number
  ox?: number
  oz?: number
}

/** Profile radius at height `y` (ignores the builder's jitter). */
export function profileRadiusAt(rings: readonly RockRing[], y: number): number {
  if (y <= rings[0].y) return rings[0].r
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i]
    const b = rings[i + 1]
    if (y <= b.y && b.y > a.y) return a.r + ((b.r - a.r) * (y - a.y)) / (b.y - a.y)
  }
  return rings[rings.length - 1].r
}

/** Non-indexed triangles with per-vertex colours and an optional float attribute. */
export class GeometryWriter {
  readonly pos: number[] = []
  readonly col: number[] = []
  readonly extra: number[] = []

  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: THREE.Color, extra?: [number, number, number]) {
    for (const v of [a, b, c]) {
      this.pos.push(v.x, v.y, v.z)
      this.col.push(color.r, color.g, color.b)
    }
    if (extra) this.extra.push(...extra)
  }

  build(extraName?: string): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3))
    if (extraName) geo.setAttribute(extraName, new THREE.Float32BufferAttribute(this.extra, 1))
    geo.computeVertexNormals()
    geo.computeBoundingSphere()
    return geo
  }
}

/**
 * Jittered prism through `rings` with a cap `capRise` above the last ring (0 = flat top);
 * band i (ring i to i+1) takes `bandColors[i]`.
 */
export function buildRingedRock(
  rings: readonly RockRing[],
  sides: number,
  jitter: number,
  seed: number,
  bandColors: readonly THREE.Color[],
  capColor: THREE.Color,
  capRise: number,
): THREE.BufferGeometry {
  const rng = createRng(seed)
  const verts = rings.map((ring) => {
    const out: THREE.Vector3[] = []
    for (let i = 0; i < sides; i++) {
      const a = ((i + (rng() - 0.5) * 0.5) / sides) * Math.PI * 2
      const r = ring.r * (1 + (rng() - 0.5) * 2 * jitter)
      out.push(new THREE.Vector3((ring.ox ?? 0) + Math.cos(a) * r, ring.y, (ring.oz ?? 0) + Math.sin(a) * r))
    }
    return out
  })
  const w = new GeometryWriter()
  for (let k = 0; k < rings.length - 1; k++) {
    const lo = verts[k]
    const hi = verts[k + 1]
    const color = bandColors[Math.min(k, bandColors.length - 1)]
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides
      w.tri(lo[i], hi[i], lo[j], color)
      w.tri(lo[j], hi[i], hi[j], color)
    }
  }
  const last = rings[rings.length - 1]
  const top = verts[verts.length - 1]
  const tip = new THREE.Vector3(last.ox ?? 0, last.y + capRise, last.oz ?? 0)
  for (let i = 0; i < sides; i++) w.tri(top[i], tip, top[(i + 1) % sides], capColor)
  return w.build()
}
