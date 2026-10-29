import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { CROW_FEATHER_MAT, CROW_GEO, createCrowFeatherMaterial, patchCrowWingVertex } from './SharedEnemyAssets'

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
