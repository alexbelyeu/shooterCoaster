import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { setRimLift, withRim, type RimUniforms } from './enemyRim'

describe('setRimLift', () => {
  it('scales every rim from its own intensity and puts it back at 1 (#829)', () => {
    const a = withRim(new THREE.MeshPhongMaterial(), { intensity: 0.4 })
    const b = withRim(new THREE.MeshStandardMaterial())
    const rim = (m: THREE.Material) => (m.userData.rim as RimUniforms).uRimIntensity.value
    setRimLift(2.5)
    expect(rim(a)).toBeCloseTo(1)
    expect(rim(b)).toBeCloseTo(1.5)
    setRimLift(1)
    expect(rim(a)).toBeCloseTo(0.4)
    expect(rim(b)).toBeCloseTo(0.6)
  })
})
