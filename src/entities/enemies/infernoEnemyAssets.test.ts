import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  DRAKE_ELBOW, DRAKE_GEO, DRAKE_JAW_HINGE, DRAKE_MAT, DRAKE_NECK_ROOT, DRAKE_PART, DRAKE_PARTS, DRAKE_SHOULDER, createDrakeMaterial, drakeRestPose,
  EMBER_WISP_CORE_GEO, EMBER_WISP_CORE_MAT, EMBER_WISP_RIBBON_MAT, EMBER_WISP_RIBBONS_GEO,
  FIRE_IMP_ARMS_GEO, FIRE_IMP_BODY_GEO, FIRE_IMP_EYES_GEO, FIRE_IMP_TAIL_GEO,
  LAVA_GOLEM_BODY_GEO, LAVA_GOLEM_FLARE_MAT, LAVA_GOLEM_LEFT_ARM_GEO, LAVA_GOLEM_LEG_GEO, LAVA_GOLEM_MAT,
  LAVA_GOLEM_RIGHT_ARM_GEO,
} from './infernoEnemyAssets'
import { DRAKE_ROAR_MAT, ENEMY_HIT_FLASH_MAT } from './SharedEnemyAssets'
import { DRAKE_ROAR, poseDrake } from './drakePose.hot'

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

  it('infernal drake: torso, neck, jaw, tail and both wings under 900', () => {
    expect(tris(DRAKE_GEO)).toBeLessThanOrEqual(900)
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

  it("paint the drake's glow only on the wings' trailing edges, the eyes and the mouth: never on its charcoal", () => {
    // The material's mask: red high, blue low (DRAKE_GLOW_APPLY).
    const glowing = (part: number) => {
      const c = DRAKE_GEO.attributes.color
      const tag = DRAKE_GEO.attributes.aPart
      let n = 0
      let all = 0
      for (let i = 0; i < c.count; i++) {
        if (tag.getX(i) !== part) continue
        all++
        if (c.getX(i) > 0.55 && c.getZ(i) < 0.2) n++
      }
      return n / all
    }
    const P = DRAKE_PART
    expect(glowing(P.body)).toBe(0)
    expect(glowing(P.tail)).toBe(0)
    for (const part of [P.rightArm, P.rightHand, P.leftArm, P.leftHand, P.neck, P.jaw]) {
      expect(glowing(part)).toBeGreaterThan(0)
      expect(glowing(part)).toBeLessThan(0.5)
    }
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
    for (const material of [EMBER_WISP_CORE_MAT, LAVA_GOLEM_MAT, DRAKE_MAT]) {
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

describe('infernal drake in one draw call (#922)', () => {
  const partBox = (part: number) => {
    const box = new THREE.Box3()
    const { position, aPart } = DRAKE_GEO.attributes
    const v = new THREE.Vector3()
    for (let i = 0; i < position.count; i++) if (aPart.getX(i) === part) box.expandByPoint(v.fromBufferAttribute(position, i))
    return box
  }

  it('tags every vertex with one of its eight parts, the left wing the right one mirrored', () => {
    const counts = new Array<number>(DRAKE_PARTS).fill(0)
    const { aPart } = DRAKE_GEO.attributes
    for (let i = 0; i < aPart.count; i++) counts[aPart.getX(i)]++
    expect(counts.every((n) => n > 0)).toBe(true)
    expect(counts.reduce((a, b) => a + b)).toBe(aPart.count)
    const P = DRAKE_PART
    for (const [right, left] of [[P.rightArm, P.leftArm], [P.rightHand, P.leftHand]]) {
      const r = partBox(right)
      const l = partBox(left)
      expect(l.min.x).toBeCloseTo(-r.max.x, 5)
      expect(l.max.x).toBeCloseTo(-r.min.x, 5)
      expect(r.min.x).toBeGreaterThan(0)
    }
  })

  it('poses each part about its joint: at rest nothing moves, the jaw stays on the neck and each hand on its arm', () => {
    const rest = drakeRestPose().value
    poseDrake(rest, { neckX: 0, neckY: 0, jaw: 0, tailX: 0, tailY: 0, arm: 0, hand: 0 })
    for (const m of rest) expect(m.equals(new THREE.Matrix4())).toBe(true)

    const roar = drakeRestPose().value
    poseDrake(roar, DRAKE_ROAR)
    const P = DRAKE_PART
    const at = (m: THREE.Matrix4, p: THREE.Vector3) => p.clone().applyMatrix4(m)
    const neckRoot = new THREE.Vector3(...DRAKE_NECK_ROOT)
    const hinge = new THREE.Vector3(...DRAKE_JAW_HINGE).add(neckRoot)
    const shoulder = new THREE.Vector3(...DRAKE_SHOULDER)
    const elbow = new THREE.Vector3(...DRAKE_ELBOW).add(shoulder)
    expect(at(roar[P.neck], neckRoot).distanceTo(neckRoot)).toBeLessThan(1e-9)
    expect(at(roar[P.jaw], hinge).distanceTo(at(roar[P.neck], hinge))).toBeLessThan(1e-9)
    expect(at(roar[P.rightArm], shoulder).distanceTo(shoulder)).toBeLessThan(1e-9)
    expect(at(roar[P.rightHand], elbow).distanceTo(at(roar[P.rightArm], elbow))).toBeLessThan(1e-9)
    // Wings thrown up: the right elbow rises, and the left one with it.
    const leftElbow = elbow.clone().setX(-elbow.x)
    expect(at(roar[P.rightArm], elbow).y).toBeGreaterThan(elbow.y + 2)
    expect(at(roar[P.leftArm], leftElbow).y).toBeCloseTo(at(roar[P.rightArm], elbow).y, 9)
    expect(at(roar[P.leftArm], leftElbow).x).toBeCloseTo(-at(roar[P.rightArm], elbow).x, 9)
  })

  it('moves its parts in the vertex shader, one program for every drake, its roar flash and the warm-up', () => {
    const { vertexShader, uniforms } = compiled(DRAKE_MAT)
    expect(vertexShader).toContain(`uniform mat4 uDrakePose[${DRAKE_PARTS}];`)
    expect(vertexShader.indexOf('uDrakePose[int(aPart')).toBeGreaterThan(vertexShader.indexOf('#include <begin_vertex>'))
    expect(uniforms.uDrakePose.value).toHaveLength(DRAKE_PARTS)
    const own = createDrakeMaterial(drakeRestPose())
    expect(own.customProgramCacheKey()).toBe(DRAKE_MAT.customProgramCacheKey())
    own.dispose()
    expect(DRAKE_ROAR_MAT.customProgramCacheKey()).toBe(`${ENEMY_HIT_FLASH_MAT.customProgramCacheKey()}-drake-pose`)
  })
})
