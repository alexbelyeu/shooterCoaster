import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { yawScaleMatrix } from './yawScaleMatrix'

describe('yawScaleMatrix', () => {
  it('turns local +x to world -z on a quarter turn, scales uniformly and moves to the position', () => {
    const m = yawScaleMatrix({ x: 10, y: 2, z: -5 }, Math.PI / 2, 3)
    const tip = new THREE.Vector3(1, 1, 0).applyMatrix4(m)
    expect(tip.x).toBeCloseTo(10)
    expect(tip.y).toBeCloseTo(5)
    expect(tip.z).toBeCloseTo(-8)
  })

  it('defaults to scale 1 and returns a fresh matrix each call', () => {
    const a = yawScaleMatrix({ x: 1, y: 0, z: 0 }, 0)
    const b = yawScaleMatrix({ x: 2, y: 0, z: 0 }, 0)
    expect(a).not.toBe(b)
    expect(a.elements[0]).toBe(1)
    expect(a.elements[12]).toBe(1)
  })
})
