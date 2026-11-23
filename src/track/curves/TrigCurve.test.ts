import { describe, expect, it } from 'vitest'
import { createTrackCurve } from './createTrackCurve'
import type { TrackCurve } from './TrackCurve'
import { getAllLevels } from '@/levels/LevelRegistry'
import type { LevelConfig, TrigTrackParams } from '@/types/level'

const SAMPLES = 1000

/** Copy because getPointAt returns a shared scratch vector. */
function pointAt(curve: TrackCurve, t: number) {
  const p = curve.getPointAt(t)
  return { x: p.x, y: p.y, z: p.z }
}

// The trig curves; an authored spline (level6) has its own tests (`SplineCurve.test.ts`, `gymTrack.test.ts`).
const levels = getAllLevels().filter((l): l is LevelConfig & { track: TrigTrackParams } => l.track.curve !== 'spline')

describe.each(levels.map((l) => [l.id, l.track] as const))('track curve for %s', (_id, track) => {
  const curve = createTrackCurve(track)

  it('produces finite points and unit tangents across 1000 samples', () => {
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES
      const p = curve.getPointAt(t)
      expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)).toBe(true)
      const tan = curve.getTangentAt(t)
      expect(Number.isFinite(tan.x) && Number.isFinite(tan.y) && Number.isFinite(tan.z)).toBe(true)
      expect(tan.length()).toBeCloseTo(1, 6)
    }
  })

  it('has no jumps between neighbouring samples (continuous inside [0, 1])', () => {
    // Upper bound on |dP/dt| from the curve formulas (sum of per-axis derivative
    // bounds, θ = 2πt). A NaN, a discontinuity or a formula typo blows past it.
    const { varA: A, varB: B, varC: C, scalar: s } = track
    const dx = 13 * C * (A + C)
    const dz = 13 * C * (1 + C)
    const dy = 2 * C * C + B
    const maxStep = (2 * Math.PI * s * (dx + dy + dz)) / SAMPLES
    let prev = pointAt(curve, 0)
    for (let i = 1; i <= SAMPLES; i++) {
      const p = pointAt(curve, i / SAMPLES)
      const step = Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z)
      expect(step).toBeLessThan(maxStep)
      prev = p
    }
  })

  it('closes horizontally: t=0 and t=1 share x/z', () => {
    const a = pointAt(curve, 0)
    const b = pointAt(curve, 1)
    expect(b.x).toBeCloseTo(a.x, 6)
    expect(b.z).toBeCloseTo(a.z, 6)
  })

  it('horizontal extent follows the varC * 13 * scalar rule', () => {
    const extent = track.varC * 13 * track.scalar
    let maxAbs = 0
    for (let i = 0; i <= SAMPLES; i++) {
      const p = curve.getPointAt(i / SAMPLES)
      maxAbs = Math.max(maxAbs, Math.abs(p.x), Math.abs(p.z))
    }
    // Never outside the rule (tiny epsilon for float error)...
    expect(maxAbs).toBeLessThanOrEqual(extent * (1 + 1e-9))
    // ...and the track actually uses most of it (the skill's sizing assumption).
    expect(maxAbs).toBeGreaterThan(extent * 0.7)
  })
})

describe('TrigCurve (curve1)', () => {
  it('is a closed loop: getPointAt(0) equals getPointAt(1)', () => {
    for (const level of levels.filter((l) => l.track.curve === 'curve1')) {
      const curve = createTrackCurve(level.track)
      const a = pointAt(curve, 0)
      const b = pointAt(curve, 1)
      expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeLessThan(1e-6)
    }
  })

  it('stays above ground level (y > 0) everywhere', () => {
    for (const level of levels.filter((l) => l.track.curve === 'curve1')) {
      const curve = createTrackCurve(level.track)
      for (let i = 0; i <= SAMPLES; i++) {
        expect(curve.getPointAt(i / SAMPLES).y).toBeGreaterThan(0)
      }
    }
  })
})
