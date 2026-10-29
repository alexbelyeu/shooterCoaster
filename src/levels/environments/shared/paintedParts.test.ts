import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { paintedAt, pose } from './paintedParts'

/** Fraction of triangles whose winding (CCW = front) agrees with their vertex normals. */
function frontFacingShare(g: THREE.BufferGeometry): number {
  const pos = g.attributes.position
  const nor = g.attributes.normal
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3()
  let agree = 0
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i)
    b.fromBufferAttribute(pos, i + 1)
    c.fromBufferAttribute(pos, i + 2)
    const face = b.sub(a).cross(c.sub(a))
    n.fromBufferAttribute(nor, i)
    if (face.dot(n) > 0) agree++
  }
  return agree / (pos.count / 3)
}

describe('paintedAt', () => {
  it('keeps faces front-facing under a mirroring matrix', () => {
    const mirrored = paintedAt(new THREE.BoxGeometry(1, 2, 3), '#ff0000', pose([4, 0, 0], [0, 0.3, 0], [-1, 1, 1]))
    expect(frontFacingShare(mirrored)).toBe(1)
    expect(mirrored.attributes.position.getX(0)).toBeLessThan(4)
  })

  it('composes nested transforms like three groups do', () => {
    const parent = pose([0, 10, 0], [0, 0, Math.PI / 2])
    const g = paintedAt(new THREE.BoxGeometry(0, 0, 0), '#fff', parent.multiply(pose([1, 0, 0])))
    const p = new THREE.Vector3().fromBufferAttribute(g.attributes.position, 0)
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(11)
  })
})
