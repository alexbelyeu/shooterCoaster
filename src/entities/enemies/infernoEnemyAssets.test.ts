import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  EMBER_WISP_CORE_GEO, EMBER_WISP_CORE_MAT, EMBER_WISP_RIBBON_MAT, EMBER_WISP_RIBBONS_GEO,
  FIRE_IMP_ARMS_GEO, FIRE_IMP_BODY_GEO, FIRE_IMP_EYES_GEO, FIRE_IMP_TAIL_GEO,
  LAVA_GOLEM_BODY_GEO, LAVA_GOLEM_FLARE_MAT, LAVA_GOLEM_LEFT_ARM_GEO, LAVA_GOLEM_LEG_GEO, LAVA_GOLEM_MAT,
  LAVA_GOLEM_RIGHT_ARM_GEO,
} from './infernoEnemyAssets'

const tris = (...gs: THREE.BufferGeometry[]) => gs.reduce((n, g) => n + (g.index?.count ?? g.attributes.position.count) / 3, 0)
const box = (g: THREE.BufferGeometry) => new THREE.Box3().setFromBufferAttribute(g.attributes.position as THREE.BufferAttribute)

/** The shader source a patched material compiles to. */
function compiled(material: THREE.Material) {
  const shader = {
    uniforms: {} as Record<string, THREE.IUniform>,
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
  }
  if (material instanceof THREE.MeshBasicMaterial) {
    shader.vertexShader = THREE.ShaderLib.basic.vertexShader
    shader.fragmentShader = THREE.ShaderLib.basic.fragmentShader
  }
  material.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer)
  return shader
}

describe("inferno enemies (#463): the briefs' triangle caps", () => {
  it('ember wisp: core, eyes and ribbons under 500', () => {
    expect(tris(EMBER_WISP_CORE_GEO, EMBER_WISP_RIBBONS_GEO)).toBeLessThanOrEqual(500)
  })

  it('fire imp: body, eyes, arms and tail under 700', () => {
    expect(tris(FIRE_IMP_BODY_GEO, FIRE_IMP_EYES_GEO, FIRE_IMP_ARMS_GEO, FIRE_IMP_TAIL_GEO)).toBeLessThanOrEqual(700)
  })

  it('lava golem: body, two legs and two arms under 900', () => {
    expect(tris(LAVA_GOLEM_BODY_GEO, LAVA_GOLEM_LEG_GEO, LAVA_GOLEM_LEG_GEO, LAVA_GOLEM_LEFT_ARM_GEO, LAVA_GOLEM_RIGHT_ARM_GEO))
      .toBeLessThanOrEqual(900)
  })
})

describe('inferno enemy models', () => {
  it('give the golem legs: they reach the ground from the hips', () => {
    expect(box(LAVA_GOLEM_LEG_GEO).min.y).toBeLessThan(-8.5)
    expect(box(LAVA_GOLEM_BODY_GEO).min.y).toBeGreaterThan(7)
  })

  it("mirror the golem arms (but for each plate's own jitter)", () => {
    const left = box(LAVA_GOLEM_LEFT_ARM_GEO)
    const right = box(LAVA_GOLEM_RIGHT_ARM_GEO)
    expect(left.min.x).toBeCloseTo(-right.max.x, 0)
    expect(left.max.x).toBeCloseTo(-right.min.x, 0)
  })

  it('paint the golem lava for the seam shader: hot inside, near-black plates outside', () => {
    const c = LAVA_GOLEM_BODY_GEO.attributes.color
    let lava = 0
    let rock = 0
    for (let i = 0; i < c.count; i++) {
      const glow = c.getX(i) - c.getZ(i)
      if (glow > 0.6) lava++
      else if (c.getX(i) < 0.2) rock++
      else throw new Error(`vertex ${i} is neither lava nor obsidian`)
    }
    expect(lava).toBeGreaterThan(0)
    expect(rock).toBeGreaterThan(0)
  })

  it('darken the imp underneath', () => {
    const { position, color } = FIRE_IMP_BODY_GEO.attributes
    const mean = (pick: (y: number) => boolean) => {
      let sum = 0
      let n = 0
      for (let i = 0; i < position.count; i++) {
        if (!pick(position.getY(i))) continue
        sum += color.getX(i)
        n++
      }
      return sum / n
    }
    expect(mean((y) => y < 1)).toBeLessThan(0.7 * mean((y) => y > 4 && y < 5))
  })

  it("mask the wisp's coal eyes out of its glow", () => {
    const c = EMBER_WISP_CORE_GEO.attributes.color
    let eyes = 0
    for (let i = 0; i < c.count; i++) if (c.getY(i) === 0) eyes++
    expect(eyes).toBeGreaterThan(0)
    expect(eyes).toBeLessThan(c.count / 4)
  })
})

describe('inferno enemy materials', () => {
  it('patch the emissive after the rim, on their own program keys', () => {
    for (const material of [EMBER_WISP_CORE_MAT, LAVA_GOLEM_MAT]) {
      const { fragmentShader } = compiled(material)
      expect(fragmentShader).toContain('uRimColor')
      expect(fragmentShader).toMatch(/emissivemap_fragment>\s*\{\s+float/)
    }
    expect(EMBER_WISP_CORE_MAT.customProgramCacheKey()).toMatch(/wisp-core$/)
  })

  it("share one program between the golem and its hit flare, with the flare's own glow", () => {
    expect(LAVA_GOLEM_FLARE_MAT.customProgramCacheKey()).toBe(LAVA_GOLEM_MAT.customProgramCacheKey())
    const normal = compiled(LAVA_GOLEM_MAT).uniforms
    const flare = compiled(LAVA_GOLEM_FLARE_MAT).uniforms
    expect(flare.uLavaGlow.value).toBeGreaterThan(2 * normal.uLavaGlow.value)
    expect(flare.uRockHeat.value).toBeGreaterThan(0)
  })

  it('wave the ribbons after begin_vertex, stronger towards their tips', () => {
    const { vertexShader } = compiled(EMBER_WISP_RIBBON_MAT)
    expect(vertexShader.indexOf('aRibbon * aRibbon')).toBeGreaterThan(vertexShader.indexOf('#include <begin_vertex>'))
    expect(EMBER_WISP_RIBBONS_GEO.attributes.aRibbon).toBeDefined()
  })
})
