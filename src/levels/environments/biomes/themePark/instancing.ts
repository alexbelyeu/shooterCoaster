import * as THREE from 'three'
import { PALETTE, type Placement } from './parkSpec'

const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3(1, 1, 1)
const _y = new THREE.Vector3(0, 1, 0)
const _c = new THREE.Color()

/** InstancedMesh ref callback: one instance per placement, optionally tinted PALETTE[colors[i]]. */
export function placeInstances(items: Placement[], colors?: number[]) {
  return (mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      _q.setFromAxisAngle(_y, it.yaw)
      _p.set(it.x, it.y, it.z)
      mesh.setMatrixAt(i, _m.compose(_p, _q, _s))
      if (colors) mesh.setColorAt(i, _c.set(PALETTE[colors[i]]))
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }
}
