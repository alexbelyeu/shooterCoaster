import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { getAllLevels, getLevelConfig } from '@/levels/LevelRegistry'
import { buildTrackIndex } from '@/levels/environments/shared/trackClearance'
import { createTrackCurve } from './curves/createTrackCurve'
import { buildArcTable } from './arcLength'
import { getTrackDimensions } from './trackDimensions'
import { TUNNEL_TRACK_SHADE, buildTrackGeometry, trackFrame } from './trackGeometry'
import {
  buildTunnelGeometry, getTunnelDims, ribCentres, tunnelColours, tunnelShadowCasters, tunnelSpans, withTunnels,
} from './setPieces'
import { tunnelAt, tunnelDepth } from './tunnelRide.hot'

const level = getLevelConfig('level1')!
const curve = createTrackCurve(level.track)
const plain = buildArcTable(curve)
const dims = getTrackDimensions(level.track)
const table = withTunnels(plain, level.track.tunnels, dims.trackScale)
const tunnel = getTunnelDims(dims.trackScale)
const span = table.tunnels![0]

describe('tunnel placement', () => {
  it('places level 1 tunnel on the arc table', () => {
    expect(table.tunnels).toHaveLength(1)
    expect(span.toS - span.fromS).toBeCloseTo(level.track.tunnels![0].length, 6)
    expect(plain.s[span.from]).toBeGreaterThanOrEqual(span.fromS)
    expect(plain.s[span.to]).toBeLessThanOrEqual(span.toS)
    expect(plain.s[span.to + 1]).toBeGreaterThan(span.toS)
  })

  it('leaves a track without tunnels the same table', () => {
    expect(withTunnels(plain, undefined, 1)).toBe(plain)
    expect(withTunnels(plain, [], 1)).toBe(plain)
    for (const l of getAllLevels().filter((x) => !x.track.tunnels)) {
      const t = buildArcTable(createTrackCurve(l.track))
      expect(withTunnels(t, l.track.tunnels, 1)).toBe(t)
    }
  })

  it('refuses a tunnel over the seam, an overlap or a bad spec', () => {
    expect(() => tunnelSpans(plain, [{ from: 0.999, length: 400 }], 1)).toThrow(/seam/)
    expect(() => tunnelSpans(plain, [{ from: 0.2, length: 400 }, { from: 0.2, length: 100 }], 1)).toThrow(/overlap/)
    expect(() => tunnelSpans(plain, [{ from: 1.2, length: 100 }], 1)).toThrow()
    expect(() => tunnelSpans(plain, [{ from: 0.2, length: 0 }], 1)).toThrow()
  })

  it('tells where the car is: inside, and how deep, easing in and out', () => {
    expect(tunnelAt(table.tunnels, span.fromS - 1)).toBe(-1)
    expect(tunnelAt(table.tunnels, (span.fromS + span.toS) / 2)).toBe(0)
    expect(tunnelAt(undefined, span.fromS)).toBe(-1)
    expect(tunnelDepth(table.tunnels, span.fromS, tunnel.ramp)).toBe(0)
    expect(tunnelDepth(table.tunnels, span.fromS + tunnel.ramp / 2, tunnel.ramp)).toBeCloseTo(0.5, 6)
    expect(tunnelDepth(table.tunnels, (span.fromS + span.toS) / 2, tunnel.ramp)).toBe(1)
    expect(tunnelDepth(table.tunnels, span.toS - tunnel.ramp / 2, tunnel.ramp)).toBeCloseTo(0.5, 6)
    expect(tunnelDepth(table.tunnels, span.toS + 1, tunnel.ramp)).toBe(0)
  })

  it('keeps props out of the tube: the track index counts a tunnel as wide as its reach', () => {
    const index = buildTrackIndex(table)
    const plainIndex = buildTrackIndex(plain)
    const mid = Math.round((span.from + span.to) / 2)
    const dx = plain.x[mid + 1] - plain.x[mid - 1]
    const dz = plain.z[mid + 1] - plain.z[mid - 1]
    const len = Math.hypot(dx, dz)
    // Beside the tube, off to one side.
    const x = plain.x[mid] - (dz / len) * (span.reach - 2)
    const z = plain.z[mid] + (dx / len) * (span.reach - 2)
    expect(plainIndex.near(x, z, 1)).toBe(false)
    expect(index.near(x, z, 1)).toBe(true)
  })
})

describe('the track in a tunnel', () => {
  it('is shaded dark inside, and the same as without tunnels everywhere else', () => {
    const lit = buildTrackGeometry(curve, plain, dims, 1000, [1, 1, 1], [1, 1, 0])
    const shaded = buildTrackGeometry(curve, table, dims, 1000, [1, 1, 1], [1, 1, 0])
    const a = lit.getAttribute('color').array
    const b = shaded.getAttribute('color').array
    const p = lit.getAttribute('position').array
    expect(b.length).toBe(a.length)
    expect(shaded.getAttribute('position').array).toEqual(p)
    let dark = 0
    let other = 0
    for (let i = 0; i < a.length; i++) {
      if (b[i] === a[i]) continue
      if (Math.abs(b[i] - a[i] * TUNNEL_TRACK_SHADE) < 1e-6) dark++
      else other++
    }
    expect(dark).toBeGreaterThan(100)
    expect(other).toBe(0)
  })
})

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

  it('spaces its light rings evenly, none at the mouths', () => {
    const ribs = ribCentres(span, tunnel)
    expect(ribs.length).toBeGreaterThan(20)
    expect(ribs[0] - span.fromS).toBeGreaterThan(tunnel.ribSpacing / 3)
    expect(span.toS - ribs[ribs.length - 1]).toBeGreaterThan(tunnel.ribSpacing / 3)
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
