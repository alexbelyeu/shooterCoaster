import { describe, expect, it } from 'vitest'
import { getAllLevels, getLevelConfig } from '@/levels/LevelRegistry'
import { buildTrackIndex } from '@/levels/environments/shared/trackClearance'
import { createTrackCurve } from './curves/createTrackCurve'
import { buildArcTable } from './arcLength'
import { getTrackDimensions } from './trackDimensions'
import { TUNNEL_TRACK_SHADE, buildTrackGeometry } from './trackGeometry'
import { getTunnelDims, otherPassInTube, ribCentres, tunnelSpans, withDarkSections, withTunnels } from './setPieces'
import { planTowers } from './supportTowers'
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

  it("places every level's tunnels: none over the seam, short of portal room or overlapping", () => {
    for (const l of getAllLevels().filter((x) => x.track.tunnels)) {
      const t = buildArcTable(createTrackCurve(l.track))
      expect(() => tunnelSpans(t, l.track.tunnels!, getTrackDimensions(l.track).trackScale), l.id).not.toThrow()
    }
  })

  it('leaves a track without tunnels the same table', () => {
    expect(withTunnels(plain, undefined, 1)).toBe(plain)
    expect(withTunnels(plain, [], 1)).toBe(plain)
    for (const l of getAllLevels().filter((x) => !x.track.tunnels)) {
      const t = buildArcTable(createTrackCurve(l.track))
      expect(withTunnels(t, l.track.tunnels, 1)).toBe(t)
    }
  })

  it('puts only a dark section with a reach on the table (#911)', () => {
    expect(withDarkSections(plain, undefined)).toBe(plain)
    const dark = { from: 0.3, to: 0.4, ramp: 0.01, flashReach: 100 }
    expect(withDarkSections(plain, [dark])).toBe(plain)
    const [cave] = withDarkSections(plain, [{ ...dark, reach: 200 }]).clearances!
    expect(cave).toEqual({ from: Math.round(0.3 * (plain.count - 1)), to: Math.round(0.4 * (plain.count - 1)), reach: 200 })
  })

  it('refuses a tunnel over the seam, an overlap or a bad spec', () => {
    expect(() => tunnelSpans(plain, [{ from: 0.999, length: 400 }], 1)).toThrow(/seam/)
    expect(() => tunnelSpans(plain, [{ from: 0.2, length: 400 }, { from: 0.2, length: 100 }], 1)).toThrow(/overlap/)
    expect(() => tunnelSpans(plain, [{ from: 1.2, length: 100 }], 1)).toThrow()
    expect(() => tunnelSpans(plain, [{ from: 0.2, length: 0 }], 1)).toThrow()
  })

  it('refuses another pass of the track through the tube, and level 1 has none', () => {
    const spec = level.track.tunnels!
    expect(otherPassInTube(table, span, tunnel.centreUp)).toBe(-1)
    const mid = (span.from + span.to) >> 1
    const far = (mid + (plain.count >> 1)) % plain.count
    const crossed = { ...plain, x: plain.x.slice(), y: plain.y.slice(), z: plain.z.slice() }
    crossed.x[far] = plain.x[mid]
    crossed.y[far] = plain.y[mid] + tunnel.centreUp
    crossed.z[far] = plain.z[mid]
    expect(() => tunnelSpans(crossed, spec, dims.trackScale)).toThrow(/passes within its reach/)
  })

  it('spaces its light rings evenly, none at the mouths', () => {
    const ribs = ribCentres(span, tunnel)
    expect(ribs.length).toBeGreaterThan(20)
    expect(ribs[0] - span.fromS).toBeGreaterThan(tunnel.ribSpacing / 3)
    expect(span.toS - ribs[ribs.length - 1]).toBeGreaterThan(tunnel.ribSpacing / 3)
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

describe('support towers round a tunnel', () => {
  let low = Infinity
  for (let i = 0; i < plain.count; i++) low = Math.min(low, plain.y[i])
  const ground = () => low - 40

  function nearestTube(t: { x: number; z: number; topY: number }): number {
    let best = Infinity
    for (let i = span.from; i <= span.to; i++) {
      if (plain.y[i] + tunnel.centreUp - span.reach > t.topY) continue
      best = Math.min(best, Math.hypot(plain.x[i] - t.x, plain.z[i] - t.z))
    }
    return best
  }

  it('keeps every tower out of the tube and its portals, which flat ground under the whole ride would stand one in', () => {
    const towers = planTowers(curve, table, dims, ground).towers
    expect(towers.length).toBeGreaterThan(0)
    expect(Math.min(...towers.map(nearestTube))).toBeGreaterThan(span.reach)
    expect(planTowers(curve, plain, dims, ground).towers.some((t) => nearestTube(t) < span.reach)).toBe(true)
  })
})
