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
  const g = geo.index ? geo.toNonIndexed() : geo
  if (g !== geo) geo.dispose()
  g.deleteAttribute('uv')
  _c.set(color)
  const n = g.attributes.position.count
  const colors = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) _c.toArray(colors, i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  _q.setFromEuler(_e.set(rotation[0], rotation[1], rotation[2]))
  g.applyMatrix4(_m.compose(_p.set(position[0], position[1], position[2]), _q, _s))
  return g
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
