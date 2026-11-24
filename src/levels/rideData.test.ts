import { describe, expect, it } from 'vitest'
import type { RailPoint } from '@/track/curves/SplineCurve'
import { createRng } from '@/utils/rng'
import { packPoints, roundNumbers, roundPoints, unpackPoints, type RidePrecision } from './rideData'

/** A ride-sized wander of control points, every third one rolled. */
function points(seed: number): RailPoint[] {
  const rand = createRng(seed)
  const out: RailPoint[] = []
  let [x, y, z] = [-1234.567, 48.25, 638.4]
  for (let i = 0; i < 300; i++) {
    x += (rand() - 0.5) * 130
    y += (rand() - 0.5) * 40
    z += (rand() - 0.5) * 130
    const p: RailPoint = { x, y, z }
    if (i % 3 === 0) {
      const a = (rand() - 0.5) * 2
      p.up = { x: Math.sin(a), y: Math.cos(a), z: (rand() - 0.5) * 0.1 }
    }
    out.push(p)
  }
  return out
}

describe('ride data', () => {
  it.each([
    [{ position: 0, up: 2 }],
    [{ position: 2, up: 4 }],
  ] as [RidePrecision][])('unpacks to the rounded points, each within half a unit of its last decimal (%o)', (precision) => {
    const source = points(precision.position + 7)
    const shipped = unpackPoints(packPoints(source, precision))
    expect(shipped).toEqual(roundPoints(source, precision))
    let worstPosition = 0
    let worstUp = 0
    let upsKept = 0
    shipped.forEach((p, i) => {
      const s = source[i]
      worstPosition = Math.max(worstPosition, Math.abs(p.x - s.x), Math.abs(p.y - s.y), Math.abs(p.z - s.z))
      if (s.up && p.up) {
        upsKept++
        worstUp = Math.max(worstUp, Math.abs(p.up.x - s.up.x), Math.abs(p.up.y - s.up.y), Math.abs(p.up.z - s.up.z))
      }
    })
    expect(shipped).toHaveLength(source.length)
    expect(upsKept).toBe(source.filter((p) => p.up).length)
    expect(worstPosition).toBeLessThanOrEqual(0.5 * 10 ** -precision.position + 1e-9)
    expect(worstUp).toBeLessThanOrEqual(0.5 * 10 ** -precision.up + 1e-12)
  })

  it('packs positions as whole-number steps', () => {
    const { xyz } = packPoints(points(3), { position: 2, up: 4 })
    expect(xyz.every(Number.isInteger)).toBe(true)
  })

  it('keeps 6 significant digits of everything else and drops float dust', () => {
    const rounded = roundNumbers({ a: 0.123456789, b: [123456.789, -1.11e-16], c: 'kept', d: { e: 98765.4321 } })
    expect(rounded).toEqual({ a: 0.123457, b: [123457, 0], c: 'kept', d: { e: 98765.4 } })
    expect(Object.is(roundNumbers(-1e-12), 0)).toBe(true)
  })
})
