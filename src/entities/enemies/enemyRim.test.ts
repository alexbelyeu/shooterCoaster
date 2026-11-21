import { afterEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { RIM_LIFT, setRimLift, withRim } from './enemyRim'

/** Runs the material's patch on a stand-in shader and returns the uniforms it wired. */
function compiledUniforms(material: THREE.Material): Record<string, { value: unknown }> {
  const shader = { uniforms: {}, vertexShader: '', fragmentShader: '' } as unknown as THREE.WebGLProgramParametersWithUniforms
  material.onBeforeCompile(shader, undefined as unknown as THREE.WebGLRenderer)
  return shader.uniforms
}

describe('setRimLift', () => {
  afterEach(() => setRimLift(1))

  it('reaches a material made after it ran, and goes back to 1 (#829)', () => {
    setRimLift(2.5)
    const late = compiledUniforms(withRim(new THREE.MeshPhongMaterial(), { intensity: 0.4 }))
    expect(late.uRimLift).toBe(RIM_LIFT)
    expect(late.uRimLift.value).toBe(2.5)
    expect(late.uRimIntensity.value).toBe(0.4)
    setRimLift(1)
    expect(late.uRimLift.value).toBe(1)
  })

  it('shares one lift across every rim material', () => {
    const a = compiledUniforms(withRim(new THREE.MeshPhongMaterial()))
    const b = compiledUniforms(withRim(new THREE.MeshStandardMaterial()))
    expect(a.uRimLift).toBe(b.uRimLift)
  })
})
