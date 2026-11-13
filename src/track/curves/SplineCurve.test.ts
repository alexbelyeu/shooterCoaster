import { describe, expect, it } from 'vitest'
import { createSplineCurve } from './SplineCurve'
import { buildArcTable } from '../arcLength'

const SQUARE = [
  { x: 0, y: 0, z: 0 },
  { x: 100, y: 10, z: 0 },
  { x: 100, y: 0, z: 100 },
  { x: 0, y: -10, z: 100 },
]
const SAMPLES = 2000

describe('createSplineCurve', () => {
  const curve = createSplineCurve(SQUARE)

  it('passes through its control points, the first at t = 0', () => {
    const table = buildArcTable(curve)
    const misses = SQUARE.map((p) => {
      let best = Infinity
      for (let i = 0; i < table.count; i++) best = Math.min(best, Math.hypot(table.x[i] - p.x, table.y[i] - p.y, table.z[i] - p.z))
      return best
    })
    expect(Math.max(...misses)).toBeLessThan(0.5)
    const start = curve.getPointAt(0)
    expect(Math.hypot(start.x, start.y, start.z)).toBeLessThan(1e-9)
  })

  it('is parameterised by arc length: equal steps in t are equal distances', () => {
    const steps: number[] = []
    const prev = curve.getPointAt(0).clone()
    for (let i = 1; i <= SAMPLES; i++) {
      const p = curve.getPointAt(i / SAMPLES)
      steps.push(p.distanceTo(prev))
      prev.copy(p)
    }
    const mean = steps.reduce((a, b) => a + b) / steps.length
    expect(Math.max(...steps.map((s) => Math.abs(s - mean) / mean))).toBeLessThan(0.02)
  })

  it('closes smoothly: t = 0 and t = 1 meet with the same unit tangent, which turns gradually everywhere', () => {
    const a = curve.getPointAt(0).clone()
    const b = curve.getPointAt(1)
    expect(a.distanceTo(b)).toBeLessThan(1e-9)
    let worstTurn = 0
    let worstLength = 0
    const prev = curve.getTangentAt(0).clone()
    for (let i = 1; i <= SAMPLES; i++) {
      const tan = curve.getTangentAt(i / SAMPLES)
      worstLength = Math.max(worstLength, Math.abs(tan.length() - 1))
      worstTurn = Math.max(worstTurn, prev.angleTo(tan))
      prev.copy(tan)
    }
    expect(worstLength).toBeLessThan(1e-9)
    expect(worstTurn).toBeLessThan(0.05)
  })

  it('wraps t outside [0, 1]', () => {
    const inside = curve.getPointAt(0.25).clone()
    expect(curve.getPointAt(1.25).distanceTo(inside)).toBeLessThan(1e-6)
    expect(curve.getPointAt(-0.75).distanceTo(inside)).toBeLessThan(1e-6)
  })

  it('needs four points', () => {
    expect(() => createSplineCurve(SQUARE.slice(0, 3))).toThrow()
  })
})
