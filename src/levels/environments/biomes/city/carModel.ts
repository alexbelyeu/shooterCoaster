import * as THREE from 'three'
import { mergePainted, paintedAt, pose } from '@/levels/environments/shared/paintedParts'
import { NEON_GAIN } from './cityNeon'

/** A car (#324): `trail` is how far its light rod reaches past each end. */
const CAR = { length: 16, width: 7.5, height: 5, trail: 18, body: 0x16171f, head: 0xfff1d6, tail: 0xff1424 } as const

/** One car, nose to +z: a dark body run through by a light rod, white ahead and red behind; a bare lamp was a speck from the ride. Caller disposes. */
export function createCarGeometry(): THREE.BufferGeometry {
  const { length, width, height, trail } = CAR
  // Two segments along z, so each triangle lies wholly ahead of the middle or behind it
  const rod = new THREE.BoxGeometry(width - 1, 1.8, length + trail * 2, 1, 1, 2)
  return mergePainted([
    paintedAt(new THREE.BoxGeometry(width, height, length), CAR.body, pose([0, height / 2, 0])),
    paintedAt(rod, (_x, _y, z) => (z > 0 ? CAR.head : CAR.tail), pose([0, height * 0.5, 0])),
  ])
}

/** The cars' unlit vertex colours, the lights burning past white as the neon does. Caller disposes. */
export function createCarMaterial(): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({ vertexColors: true })
  material.color.setScalar(NEON_GAIN)
  return material
}
