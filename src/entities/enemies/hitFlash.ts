import type * as THREE from 'three'
import { ENEMY_HIT_FLASH_MAT } from './SharedEnemyAssets'

// Hit flash: swap every mesh under an enemy to the shared flash material and
// back. Module-level callbacks so traverse() allocates nothing.
const ORIGINAL_MATERIAL = '__scOriginalMaterial'
const FLASH_MATERIAL = '__scFlashMaterial'

/**
 * Flash `mesh` with `material` instead of the shared one: a mesh whose vertex shader moves it
 * (the crow's flapping wings) needs a flash material with the same patch, or it snaps to its rest pose.
 */
export function setFlashMaterial(mesh: THREE.Mesh, material: THREE.Material) {
  mesh.userData[FLASH_MATERIAL] = material
}

export function flashMesh(o: THREE.Object3D) {
  const m = o as THREE.Mesh
  if (!m.isMesh || m.userData[ORIGINAL_MATERIAL] !== undefined) return
  m.userData[ORIGINAL_MATERIAL] = m.material
  m.material = (m.userData[FLASH_MATERIAL] as THREE.Material | undefined) ?? ENEMY_HIT_FLASH_MAT
}

export function restoreMesh(o: THREE.Object3D) {
  const m = o as THREE.Mesh
  if (!m.isMesh || m.userData[ORIGINAL_MATERIAL] === undefined) return
  m.material = m.userData[ORIGINAL_MATERIAL] as THREE.Material
  delete m.userData[ORIGINAL_MATERIAL]
}
