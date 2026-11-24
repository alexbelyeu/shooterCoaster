import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { shippedLevel } from '@/levels/shippedLevels'
import { createTrackCurve } from './curves/createTrackCurve'
import { buildArcTable } from './arcLength'
import { getTrackDimensions } from './trackDimensions'
import { buildTowerGeometry, buildTowersGeometry, getTowerDims, planTowers } from './supportTowers'

describe('buildTowersGeometry', () => {
  const track = shippedLevel('level1').track
  const curve = createTrackCurve(track)
  const dims = getTrackDimensions(track)
  const plan = planTowers(curve, buildArcTable(curve), dims, () => 0)
  const td = getTowerDims(dims)

  it('merges every tower into one geometry, each its bucket geometry turned by its yaw and moved to its top (#806)', () => {
    expect(plan.towers.length).toBeGreaterThan(1)
    const merged = buildTowersGeometry(td, plan)!
    const buckets = plan.bucketHeights.map((h) => buildTowerGeometry(td, h))
    const counts = plan.towers.map((t) => buckets[t.bucket].attributes.position.count)
    expect(merged.attributes.position.count).toBe(counts.reduce((a, b) => a + b, 0))

    // The last tower's vertices sit where its InstancedMesh matrix used to put them; its aThick turns with it.
    const t = plan.towers[plan.towers.length - 1]
    const own = buckets[t.bucket]
    const start = merged.attributes.position.count - own.attributes.position.count
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(t.x, t.topY, t.z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.yaw),
      new THREE.Vector3(1, 1, 1),
    )
    const v = new THREE.Vector3()
    const d = new THREE.Vector3()
    let worst = 0
    for (let i = 0; i < own.attributes.position.count; i++) {
      v.fromBufferAttribute(own.attributes.position, i).applyMatrix4(m)
      worst = Math.max(worst, v.distanceTo(d.fromBufferAttribute(merged.attributes.position, start + i)))
      const thick = own.attributes.aThick
      v.set(thick.getX(i), thick.getY(i), thick.getZ(i)).transformDirection(m).multiplyScalar(Math.hypot(thick.getX(i), thick.getY(i), thick.getZ(i)))
      const mt = merged.attributes.aThick
      worst = Math.max(worst, v.distanceTo(d.set(mt.getX(start + i), mt.getY(start + i), mt.getZ(start + i))))
    }
    expect(worst).toBeLessThan(1e-3)
  })

  it('is null for a track with no towers', () => {
    expect(buildTowersGeometry(td, { ...plan, towers: [] })).toBeNull()
  })
})
