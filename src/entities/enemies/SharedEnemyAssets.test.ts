import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  CLIMBER_ARM_GEO, CLIMBER_BODY_GEO, CLIMBER_LEGS_GEO, CROW_EYES_GEO, CROW_FEATHER_MAT, CROW_FLINCH_MAT, CROW_FLINCH_POSE, CROW_GEO, DUST_BUNNY_BODY_GEO, DUST_BUNNY_EYES_GEO, LANTERNFLY_FLASH_MAT,
  LANTERNFLY_FOLDED, LANTERNFLY_FOREWING_PIVOT, LANTERNFLY_GEO, LANTERNFLY_HINDWING_PIVOT, LANTERNFLY_MAT, LANTERNFLY_OPEN, RAT_BODY_GEO,
  RAT_SNOUT_GEO, RAT_TAIL_GEO, SNOWMAN_BODY_GEO, SNOWMAN_COAL_GEO, SNOWMAN_FACE_GEO,
  SNOWMAN_LEFT_ARM_GEO, SNOWMAN_RIGHT_ARM_GEO, createCrowFeatherMaterial, createLanternflyFlashMaterial, createLanternflyMaterial, crowWingPose, patchCrowWingVertex,
  patchLanternflyWingVertex,
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

  it('flinches with the wing patch, its wings snapped up', () => {
    expect(CROW_FLINCH_MAT.customProgramCacheKey()).toMatch(/-crow-wing$/)
    expect(CROW_FLINCH_POSE.x).toBeLessThan(-1)
  })

  it('stays inside the brief\'s 600 triangles', () => {
    const triangles = (CROW_GEO.attributes.position.count + CROW_EYES_GEO.attributes.position.count) / 3
    expect(triangles).toBeLessThanOrEqual(600)
  })

  it('beats down faster than it lifts, the hand trailing the arm', () => {
    const pose = new THREE.Vector2()
    const arm = (phase: number) => crowWingPose(phase, pose).x
    let down = 0
    for (let i = 0; i < 360; i++) if (arm(((i + 1) / 360) * 2 * Math.PI) > arm((i / 360) * 2 * Math.PI)) down++
    expect(down).toBeLessThan(180)
    expect(crowWingPose(Math.PI, pose).y).toBeGreaterThan(0.2)
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
      if (normal.getY(i) > 0.9 && color.getX(i) > 0.8) expect(color.getX(i)).toBeGreaterThan(0.85)
    }
  })
})

describe('gym pests (#515)', () => {
  const tris = (g: THREE.BufferGeometry) => g.attributes.position.count / 3

  it("keep under the briefs' triangle caps: rat 600, dust bunny 500", () => {
    expect(tris(RAT_BODY_GEO) + tris(RAT_SNOUT_GEO) + tris(RAT_TAIL_GEO)).toBeLessThanOrEqual(600)
    expect(tris(DUST_BUNNY_BODY_GEO) + tris(DUST_BUNNY_EYES_GEO)).toBeLessThanOrEqual(500)
  })

  it('give the rat its pink ears, nose and tail', () => {
    const pink = (g: THREE.BufferGeometry) => {
      const c = g.attributes.color
      let n = 0
      for (let i = 0; i < c.count; i++) if (c.getX(i) > c.getY(i) * 1.6) n++
      return n
    }
    expect(pink(RAT_BODY_GEO)).toBeGreaterThan(0)
    expect(pink(RAT_SNOUT_GEO)).toBeGreaterThan(0)
    expect(pink(RAT_TAIL_GEO)).toBe(RAT_TAIL_GEO.attributes.color.count)
  })
})

describe('lanternfly model (#516)', () => {
  const geo = LANTERNFLY_GEO
  const tagOf = (i: number) => geo.attributes.aWing.getX(i)
  /** Vertex indices of one part (0 body, ±1 forewing, ±2 hindwing). */
  const part = (tag: number) => [...Array(geo.attributes.position.count).keys()].filter((i) => tagOf(i) === tag)

  it("is one mesh under the brief's 500-triangle cap: body and four wings, each tagged for the shader", () => {
    expect(geo.attributes.position.count / 3).toBeLessThanOrEqual(500)
    expect([...new Set(geo.attributes.aWing.array)].sort((a, b) => a - b)).toEqual([-2, -1, 0, 1, 2])
  })

  it('mirrors each wing for the left side, facing out of the wall like the right', () => {
    const pos = geo.attributes.position
    for (const tag of [1, 2]) {
      const xs = (t: number) => part(t).map((i) => pos.getX(i))
      expect(Math.min(...xs(tag))).toBeCloseTo(-Math.max(...xs(-tag)))
      expect(geo.attributes.normal.getZ(part(tag)[0])).toBeGreaterThan(0.8)
      expect(geo.attributes.normal.getZ(part(-tag)[0])).toBeGreaterThan(0.8)
    }
  })

  it('paints the hindwings red with the white band, the forewings spotted beige', () => {
    const c = geo.attributes.color
    const count = (tag: number, test: (r: number, gr: number, b: number) => boolean) =>
      part(tag).filter((i) => test(c.getX(i), c.getY(i), c.getZ(i))).length
    expect(count(2, (r, g) => r > 0.5 && g < 0.1)).toBeGreaterThan(0)
    expect(count(2, (r, g, b) => r > 0.7 && g > 0.7 && b > 0.7)).toBeGreaterThan(0)
    expect(count(1, (r, g, b) => r < 0.02 && g < 0.02 && b < 0.02)).toBeGreaterThan(0)
    expect(count(1, (r, g) => r > 0.5 && g < 0.1)).toBe(0)
  })

  it('bounds the wings opened as well as folded, for frustum culling', () => {
    // The open pose as Lanternfly's groups had it: about the shoulder, Euler ZYX over the hindwing's fan.
    const at = (tag: number, p: typeof LANTERNFLY_OPEN) => {
      const s = Math.sign(tag)
      const hind = Math.abs(tag) === 2
      const [px, py, pz] = hind ? LANTERNFLY_HINDWING_PIVOT : LANTERNFLY_FOREWING_PIVOT
      return new THREE.Matrix4().compose(
        new THREE.Vector3(s * px, py, pz),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s * (hind ? p.hindRoll : p.foreRoll), s * (hind ? p.hindSwing : p.foreSwing), 'ZYX')),
        new THREE.Vector3(hind ? p.hindFan : 1, 1, 1),
      )
    }
    const v = new THREE.Vector3()
    let outside = 0
    for (const tag of [-2, -1, 1, 2]) {
      const open = at(tag, LANTERNFLY_OPEN).multiply(at(tag, LANTERNFLY_FOLDED).invert())
      for (const i of part(tag)) {
        if (!geo.boundingSphere!.containsPoint(v.fromBufferAttribute(geo.attributes.position, i).applyMatrix4(open))) outside++
      }
    }
    expect(outside).toBe(0)
  })

  it('opens its wings in the vertex shader, one program for every lanternfly, its hit flash and the warm-up', () => {
    const patched = patchLanternflyWingVertex(THREE.ShaderLib.standard.vertexShader)
    expect(patched).toContain('uniform float uLanternflyWings;')
    expect(patched).toMatch(/#include <begin_vertex>\s+\{\s+float side = sign\(aWing\)/)
    const wings = { value: 0.5 }
    const material = createLanternflyMaterial(wings)
    const flash = createLanternflyFlashMaterial(wings)
    expect(material.customProgramCacheKey()).toBe(LANTERNFLY_MAT.customProgramCacheKey())
    expect(flash.customProgramCacheKey()).toBe(LANTERNFLY_FLASH_MAT.customProgramCacheKey())
    expect(flash.customProgramCacheKey()).toMatch(/-lanternfly-wings$/)
    material.dispose()
    flash.dispose()
  })
})
