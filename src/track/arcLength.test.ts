import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { buildArcTable, distanceAtT, tAtDistance, tAtLoopDistance } from './arcLength'
import type { TrackCurve } from './curves/TrackCurve'

/** Straight line x = 100·t², so t is very uneven along it. */
const line: TrackCurve = {
  getPointAt: (t) => new THREE.Vector3(100 * t * t, 0, 0),
  getTangentAt: () => new THREE.Vector3(1, 0, 0),
}

describe('arc table', () => {
  const table = buildArcTable(line, 4096)

  it('measures distance from the start at any t', () => {
    for (const t of [0, 0.1, 0.37, 0.5, 0.9, 1]) expect(distanceAtT(table, t)).toBeCloseTo(100 * t * t, 3)
    expect(distanceAtT(table, -1)).toBe(0)
    expect(distanceAtT(table, 2)).toBeCloseTo(100, 6)
  })

  it('inverts tAtDistance', () => {
    for (const t of [0.01, 0.25, 0.5, 0.75, 0.99]) expect(tAtDistance(table, distanceAtT(table, t))).toBeCloseTo(t, 6)
  })

  it('wraps distances around the loop seam', () => {
    expect(tAtLoopDistance(table, 125)).toBeCloseTo(tAtDistance(table, 25), 9)
    expect(tAtLoopDistance(table, -19)).toBeCloseTo(tAtDistance(table, 81), 9)
  })
})
