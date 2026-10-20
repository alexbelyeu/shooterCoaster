import * as THREE from 'three'
import { getCollisionTargets } from './CollisionManager'
import { pickAssistTarget } from './aimAssist'

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

// Reused candidate buffers for aim assist (grown on demand, never shrunk).
let _candX: number[] = []
let _candY: number[] = []
const _p = new THREE.Vector3()
const _toTarget = new THREE.Vector3()
const _camFwd = new THREE.Vector3()

/**
 * Aim assist: find the live enemy whose projected centre is nearest to the
 * pointer (client CSS px) within `radiusPx`, and write its NDC (-1..1, y up) to
 * `out`. Returns false if no enemy is that close. `size` is the canvas rect
 * (R3F `state.size`: left/top/width/height in CSS px).
 */
export function findAssistTargetNDC(
  clientX: number,
  clientY: number,
  camera: THREE.Camera,
  size: { left: number; top: number; width: number; height: number },
  radiusPx: number,
  out: THREE.Vector2,
): boolean {
  if (!(radiusPx > 0) || size.width <= 0 || size.height <= 0) return false
  const targets = getCollisionTargets()
  if (_candX.length < targets.size) {
    _candX = new Array<number>(targets.size * 2).fill(0)
    _candY = new Array<number>(targets.size * 2).fill(0)
  }
  camera.getWorldDirection(_camFwd)
  let n = 0
  for (const t of targets.values()) {
    const pos = t.getPosition()
    // Dead / unmounted enemies park far below the world.
    if (pos.y < -9000) continue
    _toTarget.copy(pos).sub(camera.position)
    if (_toTarget.dot(_camFwd) <= 0) continue // behind the camera
    _p.copy(pos).project(camera)
    if (_p.z > 1 || Math.abs(_p.x) > 1 || Math.abs(_p.y) > 1) continue
    _candX[n] = size.left + ((_p.x + 1) / 2) * size.width
    _candY[n] = size.top + ((1 - _p.y) / 2) * size.height
    n++
  }
  const i = pickAssistTarget(clientX, clientY, _candX, _candY, n, radiusPx)
  if (i < 0) return false
  out.set(((_candX[i] - size.left) / size.width) * 2 - 1, -((_candY[i] - size.top) / size.height) * 2 + 1)
  return true
}
