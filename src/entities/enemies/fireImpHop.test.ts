import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { FIRE_IMP_BODY_GEO, FIRE_IMP_EYES_GEO } from './infernoEnemyAssets'
import {
  FIRE_IMP_HIT_RADIUS, FIRE_IMP_LIFT, FIRE_IMP_SCALE, HOP_HEIGHT, fireImpHop, hopScaleXZ, hopScaleY, type HopPose,
} from './fireImpHop.hot'

const box = (g: THREE.BufferGeometry) => new THREE.Box3().setFromBufferAttribute(g.attributes.position as THREE.BufferAttribute)

/** The farthest of `points` (model units, about the feet) from the hit sphere's centre over a whole hop cycle. */
function farthestOverHop(points: THREE.Vector3[]) {
  const pose: HopPose = { air: 0, land: 0, stretch: 0 }
  const m = new THREE.Matrix4()
  const p = new THREE.Vector3()
  let worst = 0
  for (let i = 0; i <= 200; i++) {
    fireImpHop(i / 200, pose)
    const xz = hopScaleXZ(pose)
    // FireImp.tsx: model group (lift, scale) > hop group (rise, tilt, squash).
    m.makeTranslation(0, -FIRE_IMP_LIFT, 0)
      .multiply(new THREE.Matrix4().makeScale(FIRE_IMP_SCALE, FIRE_IMP_SCALE, FIRE_IMP_SCALE))
      .multiply(new THREE.Matrix4().makeTranslation(0, HOP_HEIGHT * pose.air, 0))
      .multiply(new THREE.Matrix4().makeRotationX(0.15 * pose.air))
      .multiply(new THREE.Matrix4().makeScale(xz, hopScaleY(pose), xz))
    for (const q of points) worst = Math.max(worst, p.copy(q).applyMatrix4(m).length())
  }
  return worst
}

describe('fire imp hit sphere (#630)', () => {
  it('covers its eyes through the whole hop', () => {
    const eyes = box(FIRE_IMP_EYES_GEO)
    const corners = [-1, 1].flatMap((sx) => [new THREE.Vector3(sx * eyes.max.x, eyes.max.y, eyes.max.z), new THREE.Vector3(sx * eyes.max.x, eyes.min.y, eyes.max.z)])
    expect(farthestOverHop(corners)).toBeLessThan(FIRE_IMP_HIT_RADIUS)
  })

  it('covers its feet', () => {
    const body = box(FIRE_IMP_BODY_GEO)
    expect(farthestOverHop([new THREE.Vector3(0, body.min.y, 0)])).toBeLessThan(FIRE_IMP_HIT_RADIUS)
  })

  it('is centred mid-body, not at the feet', () => {
    expect(FIRE_IMP_LIFT).toBeGreaterThan((box(FIRE_IMP_BODY_GEO).max.y * FIRE_IMP_SCALE) / 3)
  })
})
