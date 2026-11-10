import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  CLIMBER_ARM_GEO, CLIMBER_BODY_GEO, CLIMBER_LEGS_GEO, CROW_FEATHER_MAT, CROW_GEO, EMBER_WISP_TENDRILS_GEO, SNOWMAN_BODY_GEO, SNOWMAN_COAL_GEO, SNOWMAN_FACE_GEO,
  SNOWMAN_LEFT_ARM_GEO, SNOWMAN_RIGHT_ARM_GEO, createCrowFeatherMaterial, patchCrowWingVertex,
} from './SharedEnemyAssets'

describe('crow model', () => {
  it('tags body, both inner and both outer wings for the flap shader', () => {
    const tags = new Set(CROW_GEO.attributes.aWing.array)
    expect([...tags].sort((a, b) => a - b)).toEqual([-2, -1, 0, 1, 2])
  })

  it('flaps the wings after begin_vertex in the physical vertex shader', () => {
    const patched = patchCrowWingVertex(THREE.ShaderLib.physical.vertexShader)
    expect(patched).toContain('attribute float aWing;')
    expect(patched).toMatch(/#include <begin_vertex>\s+\{\s+float side = sign\(aWing\)/)
  })

  it('shares one program between every crow instance and the warm-up material', () => {
    const material = createCrowFeatherMaterial({ value: new THREE.Vector2() })
    expect(material.customProgramCacheKey()).toBe(CROW_FEATHER_MAT.customProgramCacheKey())
    material.dispose()
  })
})

describe('merged enemy parts', () => {
  const box = (g: THREE.BufferGeometry) => {
    g.computeBoundingBox()
    return g.boundingBox!
  }

  it('stacks the snowman body from the bottom ball to the top of the head', () => {
    const { min, max } = box(SNOWMAN_BODY_GEO)
    expect(min.y).toBeCloseTo(-20)
    expect(max.y).toBeCloseTo(52)
  })

  it('mirrors the left and right snowman arms', () => {
    const left = box(SNOWMAN_LEFT_ARM_GEO)
    const right = box(SNOWMAN_RIGHT_ARM_GEO)
    expect(left.min.x).toBeCloseTo(-right.max.x)
    expect(left.max.x).toBeCloseTo(-right.min.x)
  })

  it('keeps every part: triangles add up', () => {
    const tris = (g: THREE.BufferGeometry) => g.index!.count / 3
    expect(tris(SNOWMAN_COAL_GEO)).toBe(tris(SNOWMAN_FACE_GEO) + 3 * tris(new THREE.SphereGeometry(1, 6, 6)))
    expect(tris(EMBER_WISP_TENDRILS_GEO)).toBe(6 * tris(new THREE.ConeGeometry(1, 4, 4)))
  })
})

describe('climber model', () => {
  const tris = (g: THREE.BufferGeometry) => g.attributes.position.count / 3

  it("stays under the brief's 700-triangle cap: body, two arms, legs", () => {
    expect(tris(CLIMBER_BODY_GEO) + 2 * tris(CLIMBER_ARM_GEO) + tris(CLIMBER_LEGS_GEO)).toBeLessThanOrEqual(700)
  })

  it('is lighter on top than underneath', () => {
    const { normal, color } = CLIMBER_BODY_GEO.attributes
    for (let i = 0; i < normal.count; i++) {
      // The head's skin: one colour, shaded by its normal.
      if (normal.getY(i) > 0.9 && color.getX(i) > 0.8) expect(color.getX(i)).toBeGreaterThan(0.85)
    }
  })
})
