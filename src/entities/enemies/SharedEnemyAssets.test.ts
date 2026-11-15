import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  CLIMBER_ARM_GEO, CLIMBER_BODY_GEO, CLIMBER_LEGS_GEO, CROW_EYES_GEO, CROW_FEATHER_MAT, CROW_FLINCH_MAT, CROW_FLINCH_POSE, CROW_GEO, DUST_BUNNY_BODY_GEO, DUST_BUNNY_EYES_GEO, EMBER_WISP_TENDRILS_GEO, LANTERNFLY_BODY_GEO,
  LANTERNFLY_FOREWING_GEOS, LANTERNFLY_HINDWING_GEOS, RAT_BODY_GEO,
  RAT_SNOUT_GEO, RAT_TAIL_GEO, SNOWMAN_BODY_GEO, SNOWMAN_COAL_GEO, SNOWMAN_FACE_GEO,
  SNOWMAN_LEFT_ARM_GEO, SNOWMAN_RIGHT_ARM_GEO, createCrowFeatherMaterial, crowWingPose, patchCrowWingVertex,
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
  const tris = (g: THREE.BufferGeometry) => g.attributes.position.count / 3
  const wings = [...LANTERNFLY_FOREWING_GEOS, ...LANTERNFLY_HINDWING_GEOS]

  it("stays under the brief's 500-triangle cap: body and four wings", () => {
    expect(tris(LANTERNFLY_BODY_GEO) + wings.reduce((n, g) => n + tris(g), 0)).toBeLessThanOrEqual(500)
  })

  it('mirrors each wing for the left side, facing out of the wall like the right', () => {
    for (const [right, left] of [LANTERNFLY_FOREWING_GEOS, LANTERNFLY_HINDWING_GEOS]) {
      right.computeBoundingBox()
      left.computeBoundingBox()
      expect(right.boundingBox!.min.x).toBeCloseTo(-left.boundingBox!.max.x)
      const n = (g: THREE.BufferGeometry) => g.attributes.normal.getZ(0)
      expect(n(right)).toBeGreaterThan(0.99)
      expect(n(left)).toBeGreaterThan(0.99)
    }
  })

  it('paints the hindwings red with the white band, the forewings spotted beige', () => {
    const count = (g: THREE.BufferGeometry, test: (r: number, gr: number, b: number) => boolean) => {
      const c = g.attributes.color
      let k = 0
      for (let i = 0; i < c.count; i++) if (test(c.getX(i), c.getY(i), c.getZ(i))) k++
      return k
    }
    const [hind] = LANTERNFLY_HINDWING_GEOS
    const [fore] = LANTERNFLY_FOREWING_GEOS
    expect(count(hind, (r, g) => r > 0.5 && g < 0.1)).toBeGreaterThan(0)
    expect(count(hind, (r, g, b) => r > 0.7 && g > 0.7 && b > 0.7)).toBeGreaterThan(0)
    expect(count(fore, (r, g, b) => r < 0.02 && g < 0.02 && b < 0.02)).toBeGreaterThan(0)
    expect(count(fore, (r, g) => r > 0.5 && g < 0.1)).toBe(0)
  })
})
