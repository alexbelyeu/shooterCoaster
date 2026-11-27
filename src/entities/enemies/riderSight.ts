import * as THREE from 'three'

const _look = new THREE.Vector3()
const _to = new THREE.Vector3()

/** Within `near` of the rider and within `seenCos` (cosine) of its look: the rider has seen it (#1059's escapes). */
export function inRiderSight(p: THREE.Vector3, camera: THREE.Camera, near: number, seenCos: number): boolean {
  _to.subVectors(p, camera.position)
  const d = _to.length()
  return d < near && _to.dot(camera.getWorldDirection(_look)) > seenCos * d
}
