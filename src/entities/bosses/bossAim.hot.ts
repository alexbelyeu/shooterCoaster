import * as THREE from 'three'
import { followHeading, type FlatDir } from './bossCycle.hot'
import type { PerchInput } from './scorpionMotion.hot'

/** The camera's view direction flat on the ground, unit length (-z when it looks straight up or down). */
export function flatForward(camera: THREE.Object3D, out: THREE.Vector3): THREE.Vector3 {
  camera.getWorldDirection(out)
  out.y = 0
  if (out.lengthSq() < 1e-6) out.set(0, 0, -1)
  return out.normalize()
}

const _fwd = new THREE.Vector3()

/** Each frame: the camera's position into `cam`, its heading eased through the loops into `aim`, both into `input` for `pickPerch`. */
export function aimAtRider(camera: THREE.Object3D, cam: THREE.Vector3, aim: { heading: FlatDir; headed: boolean }, input: PerchInput, dt: number): void {
  camera.getWorldPosition(cam)
  flatForward(camera, _fwd)
  followHeading(aim.heading, _fwd.x, _fwd.z, dt, !aim.headed)
  aim.headed = true
  input.camera.x = cam.x
  input.camera.z = cam.z
  input.forwardX = aim.heading.x
  input.forwardZ = aim.heading.z
}
