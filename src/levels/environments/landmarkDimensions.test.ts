import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { ARCH_RADIUS, archFeet } from './landmarkDimensions'

describe('landmarkDimensions', () => {
  it('puts the arch feet where the rotated, scaled group draws its pillars', () => {
    const arch = { pos: [600, 0, 1400] as const, rotY: 2.8, scale: 1.15 }
    const group = new THREE.Object3D()
    group.position.set(...arch.pos)
    group.rotation.y = arch.rotY
    group.updateMatrixWorld()
    archFeet(arch).forEach((foot, i) => {
      const side = i === 0 ? -1 : 1
      const p = new THREE.Vector3(side * ARCH_RADIUS * arch.scale, 0, 0).applyMatrix4(group.matrixWorld)
      expect(foot.x).toBeCloseTo(p.x, 6)
      expect(foot.z).toBeCloseTo(p.z, 6)
    })
  })
})
