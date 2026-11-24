import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { shippedLevel } from '@/levels/shippedLevels'
import { buildArcTable } from '@/track/arcLength'
import { createTrackCurve } from '@/track/curves/createTrackCurve'
import { buildTrackIndex } from '../../shared/trackClearance'
import { trackExtent } from '../../shared/trackScatter'
import { yawScaleMatrix } from '../../shared/yawScaleMatrix'
import { CITY_REACH, layoutCity, streetTowers } from './cityLayout'
import { laneRuns, layoutTraffic, SINK } from './trafficPaths'
import { sinkAt, writeTraffic } from './traffic.hot'

const table = buildArcTable(createTrackCurve(shippedLevel('level7').track))
const reach = trackExtent(table) * CITY_REACH
// The towers `Decorations.tsx` lays the lanes between
const towers = streetTowers(layoutCity(table, trackExtent(table)))
const track = buildTrackIndex(table)
const runs = laneRuns(table, reach, towers)
const traffic = layoutTraffic(runs, 0)

describe('city traffic', () => {
  it('is seeded: the same traffic every visit', () => {
    expect(layoutTraffic(laneRuns(table, reach, towers), 0)).toEqual(traffic)
  })

  it('fills the streets with cars, inside the city', () => {
    expect(runs.length).toBeGreaterThan(40)
    expect(traffic.count).toBeGreaterThan(300)
    const outside = runs.filter((r) => Math.hypot(r.x, r.z) > reach + 1 || Math.hypot(r.x + r.dx * r.length, r.z + r.dz * r.length) > reach + 1)
    expect(outside).toEqual([])
  })

  it('keeps every run off the towers and the track', () => {
    const hits: string[] = []
    for (const r of runs) {
      for (let s = 0; s <= r.length; s += 4) {
        const x = r.x + r.dx * s
        const z = r.z + r.dz * s
        if (towers.some((t) => Math.abs(x - t.x) < t.w / 2 && Math.abs(z - t.z) < t.d / 2)) hits.push(`(${x.toFixed(0)}, ${z.toFixed(0)}) in a tower`)
        if (track.near(x, z, 30)) hits.push(`(${x.toFixed(0)}, ${z.toFixed(0)}) under the track`)
      }
    }
    expect(hits.slice(0, 5)).toEqual([])
  })

  it('poses each car as yawScaleMatrix would, sunk at its run ends', () => {
    const out = new Float32Array(traffic.count * 16)
    const t = 3.7
    writeTraffic(traffic, traffic.count, t, out)
    let worst = 0
    for (const i of [0, 1, Math.floor(traffic.count / 2), traffic.count - 1]) {
      const [length, at, speed] = traffic.run.slice(i * 3, i * 3 + 3)
      const s = (at + speed * t) % length
      const [dx, dz] = traffic.dir.slice(i * 2, i * 2 + 2)
      const [x, y, z] = traffic.start.slice(i * 3, i * 3 + 3)
      const want = yawScaleMatrix({ x: x + dx * s, y: y - sinkAt(s, length), z: z + dz * s }, Math.atan2(dx, dz))
      const got = new THREE.Matrix4().fromArray(out, i * 16)
      worst = Math.max(worst, ...want.elements.map((e, k) => Math.abs(e - got.elements[k])))
    }
    expect(worst).toBeLessThan(1e-3)
  })

  it('sinks a car only near its run ends', () => {
    expect(sinkAt(0, 300)).toBe(SINK.depth)
    expect(sinkAt(300, 300)).toBe(SINK.depth)
    expect(sinkAt(SINK.length, 300)).toBe(0)
    expect(sinkAt(150, 300)).toBe(0)
  })
})
