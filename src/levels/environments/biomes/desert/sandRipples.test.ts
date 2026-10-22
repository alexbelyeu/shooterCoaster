import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createSandTerrainMaterial } from './sandRipples'

describe('createSandTerrainMaterial', () => {
  it('patches the Phong shader chunks it relies on', () => {
    const material = createSandTerrainMaterial()
    const shader = {
      vertexShader: THREE.ShaderLib.phong.vertexShader,
      fragmentShader: THREE.ShaderLib.phong.fragmentShader,
      uniforms: {},
    } as unknown as THREE.WebGLProgramParametersWithUniforms
    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer)
    expect(shader.vertexShader).toContain('vSandPos = (modelMatrix')
    // After the normal is known, before lighting reads diffuseColor.
    const f = shader.fragmentShader
    const at = f.indexOf('sandRipples(vSandPos.xz)')
    expect(at).toBeGreaterThan(f.indexOf('#include <normal_fragment_maps>'))
    expect(at).toBeLessThan(f.indexOf('#include <lights_phong_fragment>'))
    material.dispose()
  })
})
