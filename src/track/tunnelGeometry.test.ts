import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { createTrackCurve } from './curves/createTrackCurve'
import { buildArcTable } from './arcLength'
import { getTrackDimensions } from './trackDimensions'
import { trackFrame } from './trackGeometry'
import { getTunnelDims, withTunnels } from './setPieces'
import { buildTunnelGeometry, tunnelColours, tunnelShadowCasters } from './tunnelGeometry'

const level = getLevelConfig('level1')!
const curve = createTrackCurve(level.track)
const plain = buildArcTable(curve)
const dims = getTrackDimensions(level.track)
const table = withTunnels(plain, level.track.tunnels, dims.trackScale)
const tunnel = getTunnelDims(dims.trackScale)
const span = table.tunnels![0]

describe('tunnel geometry', () => {
  const geometry = buildTunnelGeometry(curve, table, tunnel, tunnelColours([0.95, 0.93, 0.88], [1, 1, 0]))
  const pos = geometry.getAttribute('position')
  const nor = geometry.getAttribute('normal')
  const emi = geometry.getAttribute('aEmissive')

  it('is one modest mesh of finite triangles, each wound the way its normals face', () => {
    expect(pos.count % 3).toBe(0)
    expect(pos.count / 3).toBeLessThan(12000)
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    const c = new THREE.Vector3()
    const n = new THREE.Vector3()
    let finite = true
    let misWound = 0
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i)
      b.fromBufferAttribute(pos, i + 1).sub(a)
      c.fromBufferAttribute(pos, i + 2).sub(a)
      n.fromBufferAttribute(nor, i)
      finite &&= Number.isFinite(a.x + a.y + a.z + b.x + b.y + b.z + c.x + c.y + c.z)
      if (b.cross(c).dot(n) < 0) misWound++
    }
    expect(finite).toBe(true)
    expect(misWound).toBe(0)
  })

  it('lights the inside: emissive past 1 for Bloom, never NaN', () => {
    let max = 0
    let finite = true
    for (let i = 0; i < emi.count; i++) {
      const v = Math.max(emi.getX(i), emi.getY(i), emi.getZ(i))
      finite &&= Number.isFinite(v) && v >= 0
      max = Math.max(max, v)
    }
    expect(finite).toBe(true)
    expect(max).toBeGreaterThan(1)
  })

  it('has room for the rider: the eye stays well inside the light rings all the way through', () => {
    const point = new THREE.Vector3()
    const f = new THREE.Vector3()
    const r = new THREE.Vector3()
    const u = new THREE.Vector3()
    const eye = new THREE.Vector3()
    const ribInner = tunnel.radius - tunnel.ribDepth
    let worst = Infinity
    for (let i = span.from; i <= span.to; i += 4) {
      trackFrame(curve, plain.t[i], point, f, r, u)
      eye.copy(point).setY(point.y + dims.eyeHeight)
      const centre = point.clone().addScaledVector(u, tunnel.centreUp)
      const off = eye.sub(centre)
      off.addScaledVector(f, -off.dot(f))
      worst = Math.min(worst, ribInner - off.length())
    }
    // The camera's near plane is 1 unit; the gun sits inside 2.
    expect(worst).toBeGreaterThan(3)
  })

  it('casts contact shadows only where the tube is near the ground', () => {
    const flat = tunnelShadowCasters(table, tunnel, () => -1e6)
    const near = tunnelShadowCasters(table, tunnel, (x, z) => {
      void x
      void z
      return Math.min(...Array.from(plain.y.subarray(span.from, span.to))) - 2 * tunnel.radius
    })
    expect(flat).toEqual([])
    expect(near.length).toBeGreaterThan(5)
    for (const c of near) expect(c.strength).toBeGreaterThan(0)
  })
})
