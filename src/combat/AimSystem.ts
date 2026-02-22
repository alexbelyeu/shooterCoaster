import * as THREE from 'three'

const _raycaster = new THREE.Raycaster()
const _ndc = new THREE.Vector2()

/**
 * Convert mouse position to raycaster.
 * Port of Poem.js mouse handler.
 */
export function getAimRay(
  mouseX: number,
  mouseY: number,
  camera: THREE.Camera,
): THREE.Raycaster {
  _ndc.set(mouseX, mouseY)
  _raycaster.setFromCamera(_ndc, camera)
  return _raycaster
}

/**
 * Get world-space aim direction from NDC mouse coords and camera.
 */
export function getAimDirection(
  ndcX: number,
  ndcY: number,
  camera: THREE.Camera,
  out: THREE.Vector3,
): THREE.Vector3 {
  _ndc.set(ndcX, ndcY)
  _raycaster.setFromCamera(_ndc, camera)
  return out.copy(_raycaster.ray.direction)
}
