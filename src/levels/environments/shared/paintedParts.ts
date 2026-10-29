import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Multi-coloured props in one draw call: vertex-colour each primitive, place it,
// merge, and render with `vertexColors: true`.

const _m = new THREE.Matrix4()
const _e = new THREE.Euler()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3(1, 1, 1)
const _c = new THREE.Color()

/** Non-indexed copy of `geo` (which is disposed), painted, rotated then moved. */
export function painted(
  geo: THREE.BufferGeometry,
  color: THREE.ColorRepresentation,
  position: [number, number, number] = [0, 0, 0],
  rotation: [number, number, number] = [0, 0, 0],
): THREE.BufferGeometry {
  return paintedAt(geo, color, pose(position, rotation, undefined, _m))
}

/** Like `painted`, placed by any matrix (nested groups, scale); a mirroring matrix keeps faces front-facing. */
export function paintedAt(
  geo: THREE.BufferGeometry,
  color: THREE.ColorRepresentation,
  matrix: THREE.Matrix4,
): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo
  if (g !== geo) geo.dispose()
  g.deleteAttribute('uv')
  _c.set(color)
  const n = g.attributes.position.count
  const colors = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) _c.toArray(colors, i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.applyMatrix4(matrix)
  if (matrix.determinant() < 0) flipWinding(g)
  return g
}

/** Local transform as a matrix (into `out`, or a new one), as three composes position / rotation / scale. */
export function pose(
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1],
  out = new THREE.Matrix4(),
): THREE.Matrix4 {
  _q.setFromEuler(_e.set(rotation[0], rotation[1], rotation[2]))
  return out.compose(_p.set(position[0], position[1], position[2]), _q, _s.set(scale[0], scale[1], scale[2]))
}

/** Swap the 2nd and 3rd corner of every triangle of a non-indexed geometry. */
function flipWinding(g: THREE.BufferGeometry): void {
  for (const attr of Object.values(g.attributes) as THREE.BufferAttribute[]) {
    const { array, itemSize } = attr
    for (let t = 0; t < attr.count; t += 3) {
      for (let k = 0; k < itemSize; k++) {
        const b = (t + 1) * itemSize + k
        const c = (t + 2) * itemSize + k
        const tmp = array[b]
        array[b] = array[c]
        array[c] = tmp
      }
    }
  }
}

/** Flat polygon from triangle corners [x, y, z, ...]. */
export function paintedPolygon(corners: number[], color: THREE.ColorRepresentation): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(corners, 3))
  g.computeVertexNormals()
  return painted(g, color)
}

/** Disposes the parts. */
export function mergePainted(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts)
  for (const p of parts) p.dispose()
  g.computeBoundingSphere()
  return g
}
