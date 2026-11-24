import * as THREE from 'three'
import { mergePainted, paintedAt, pose } from '@/levels/environments/shared/paintedParts'
import type { NeonColor, NeonSign, Tower } from './cityLayout'

/** sRGB neon; the material scales them past the bloom threshold. */
export const NEON_RGB: Record<NeonColor, number> = { magenta: 0xff2fb0, cyan: 0x2ee8ff, amber: 0xffa424 }

/** How far past white the neon burns, so the bloom picks it up. */
const NEON_GAIN = 2.2

/** Every slab as one vertex-coloured geometry: one draw call for all the city's neon. Caller disposes. */
export function neonGeometry(signs: readonly NeonSign[]): THREE.BufferGeometry {
  return mergePainted(
    signs.map((s) => paintedAt(new THREE.BoxGeometry(s.w, s.h, s.d), NEON_RGB[s.color], pose([s.x, s.y, s.z], [0, s.yaw, 0]))),
  )
}

/** Unlit neon, burning past white. Caller disposes. */
export function createNeonMaterial(): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({ vertexColors: true })
  material.color.setScalar(NEON_GAIN)
  return material
}

/** Unit box standing on y = 0: every tower is one instance of it, scaled (`towerMatrix`). Caller disposes. */
export function createTowerGeometry(): THREE.BufferGeometry {
  return new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
}

const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _q = new THREE.Quaternion()

/** A tower's instance matrix, its base `sink` below the ground at `baseY` so it never floats on a swell. */
export function towerMatrix(t: Tower, baseY: number, sink = 4): THREE.Matrix4 {
  return new THREE.Matrix4().compose(_p.set(t.x, baseY - sink, t.z), _q, _s.set(t.w, t.h + sink, t.d))
}
