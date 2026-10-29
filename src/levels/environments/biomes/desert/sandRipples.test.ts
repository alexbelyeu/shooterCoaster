import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { patchSandShader } from './sandRipples'

describe('patchSandShader', () => {
  it('injects the ripple into Phong after the normal is known and before lighting', () => {
    const shader = { vertexShader: THREE.ShaderLib.phong.vertexShader, fragmentShader: THREE.ShaderLib.phong.fragmentShader }
    patchSandShader(shader)
    expect(shader.vertexShader).toContain('vSandPos = (modelMatrix')
    const f = shader.fragmentShader
    const at = f.indexOf('sandRipples(vSandPos.xz)')
    expect(at).toBeGreaterThan(f.indexOf('#include <normal_fragment_maps>'))
    expect(at).toBeLessThan(f.indexOf('#include <lights_phong_fragment>'))
  })

  it('reaches fwidth() outside any branch on the per-pixel sand mask', () => {
    const shader = { vertexShader: THREE.ShaderLib.phong.vertexShader, fragmentShader: THREE.ShaderLib.phong.fragmentShader }
    patchSandShader(shader)
    const f = shader.fragmentShader
    const body = f.slice(f.indexOf('float flatness'), f.indexOf('sandRipples(vSandPos.xz)'))
    expect(body).not.toMatch(/\bif\s*\(/)
  })
})
