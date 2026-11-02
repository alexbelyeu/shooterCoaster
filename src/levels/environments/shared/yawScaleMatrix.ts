import * as THREE from 'three'

export interface YawPlacement {
  x: number
  y: number
  z: number
  yaw: number
  scale?: number
}

const UP = new THREE.Vector3(0, 1, 0)
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()

export function yawScaleMatrix(pos: { x: number; y: number; z: number }, yaw: number, scale = 1): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    _p.set(pos.x, pos.y, pos.z),
    _q.setFromAxisAngle(UP, yaw),
    _s.set(scale, scale, scale),
  )
}
