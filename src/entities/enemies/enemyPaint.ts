import * as THREE from 'three'

// Vertex-paint and shaping helpers for the enemy characters (#463, #813): they work on `paintedParts` geometry
// (non-indexed, with a colour attribute) before it is merged.

/** Each vertex's colour from its own position (after placement). */
export function recolor(g: THREE.BufferGeometry, paint: (x: number, y: number, z: number, out: THREE.Color) => void): THREE.BufferGeometry {
  const p = g.attributes.position
  const c = g.attributes.color
  const col = new THREE.Color()
  for (let i = 0; i < p.count; i++) {
    paint(p.getX(i), p.getY(i), p.getZ(i), col.setRGB(c.getX(i), c.getY(i), c.getZ(i)))
    c.setXYZ(i, col.r, col.g, col.b)
  }
  return g
}

/** Darker underneath: colours scaled from `low` at `y0` up to 1 at `y1` (the brief's gradient by height). */
export function darkUnder(g: THREE.BufferGeometry, y0: number, y1: number, low: number): THREE.BufferGeometry {
  return recolor(g, (_x, y, _z, c) => c.multiplyScalar(low + (1 - low) * THREE.MathUtils.smoothstep(y, y0, y1)))
}

/** Bends a part built along +y: each vertex is offset by `offset(h)` in x and z, `h` its height above the base. */
export function bent(geo: THREE.BufferGeometry, offset: (h: number) => [number, number]): THREE.BufferGeometry {
  geo.computeBoundingBox()
  const base = geo.boundingBox!.min.y
  const p = geo.attributes.position
  for (let i = 0; i < p.count; i++) {
    const [dx, dz] = offset(p.getY(i) - base)
    p.setXYZ(i, p.getX(i) + dx, p.getY(i), p.getZ(i) + dz)
  }
  geo.computeVertexNormals()
  return geo
}

/** A flat fin from its outline (x, y pairs, counter-clockwise), `thickness` deep, centred on z = 0. */
export function fin(outline: [number, number][], thickness: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)))
  return new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false }).translate(0, 0, -thickness / 2)
}

/** A unit sphere with its sides lifted: squashed flat, a grin with the corners up. */
export function grin(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const p = geo.attributes.position
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + 0.9 * p.getX(i) ** 2)
  geo.computeVertexNormals()
  return geo
}
