import type * as THREE from 'three'
import { ENEMY_HIT_FLASH_MAT } from './SharedEnemyAssets'

// Hit flash: swap every mesh under an enemy to the shared flash material and
// back. Module-level callbacks so traverse() allocates nothing.
const ORIGINAL_MATERIAL = '__scOriginalMaterial'

export function flashMesh(o: THREE.Object3D) {
  const m = o as THREE.Mesh
  if (!m.isMesh || m.userData[ORIGINAL_MATERIAL] !== undefined) return
  m.userData[ORIGINAL_MATERIAL] = m.material
  m.material = ENEMY_HIT_FLASH_MAT
}

export function restoreMesh(o: THREE.Object3D) {
  const m = o as THREE.Mesh
  if (!m.isMesh || m.userData[ORIGINAL_MATERIAL] === undefined) return
  m.material = m.userData[ORIGINAL_MATERIAL] as THREE.Material
  delete m.userData[ORIGINAL_MATERIAL]
}
