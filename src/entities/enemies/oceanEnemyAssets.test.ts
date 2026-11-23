import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { SHARK_BODY_GEO, SHARK_TAIL_GEO } from './oceanEnemyAssets'

const tris = (...gs: THREE.BufferGeometry[]) => gs.reduce((n, g) => n + (g.index?.count ?? g.attributes.position.count) / 3, 0)

describe('shark (#813)', () => {
  it("keeps body and tail under the brief's 700 triangles", () => {
    expect(tris(SHARK_BODY_GEO, SHARK_TAIL_GEO)).toBeLessThanOrEqual(700)
  })

  it('is counter-shaded: a white belly under a steel-blue back', () => {
    const { position, color } = SHARK_BODY_GEO.attributes
    const mean = (pick: (y: number, z: number) => boolean) => {
      const sum = [0, 0, 0]
      let n = 0
      for (let i = 0; i < position.count; i++) {
        if (!pick(position.getY(i), position.getZ(i))) continue
        sum[0] += color.getX(i)
        sum[2] += color.getZ(i)
        n++
      }
      return sum.map((s) => s / n)
    }
    // Along the torso, away from the fins and the head's parts.
    const belly = mean((y, z) => y < -1.8 && z > -2 && z < 0.8)
    const back = mean((y, z) => y > 1 && y < 2 && z > -2 && z < 0)
    expect(belly[0]).toBeGreaterThan(0.45)
    expect(back[2]).toBeGreaterThan(back[0])
    expect(back[2]).toBeLessThan(0.3)
  })
})
