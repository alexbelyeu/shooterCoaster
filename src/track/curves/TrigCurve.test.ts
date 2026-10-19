import { describe, expect, it } from 'vitest'
import { createTrigCurve } from './TrigCurve'
import { createTrigCurve2 } from './TrigCurve2'
import { getAllLevels } from '@/levels/LevelRegistry'
import { generateTrackSegment } from '@/track/ProceduralTrackGenerator'
import type { TrackParams } from '@/types/level'

const SAMPLES = 1000

function curveFor(track: TrackParams) {
  const factory = track.curve === 'curve2' ? createTrigCurve2 : createTrigCurve
  return factory(track.varA, track.varB, track.varC, track.scalar)
}

/** Copy because getPointAt returns a shared scratch vector. */
function pointAt(curve: ReturnType<typeof createTrigCurve>, t: number) {
  const p = curve.getPointAt(t)
  return { x: p.x, y: p.y, z: p.z }
}

const levels = getAllLevels()

describe.each(levels.map((l) => [l.id, l.track] as const))('track curve for %s', (_id, track) => {
  const curve = curveFor(track)

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
    const dy = 2 * Math.PI * C * C + C + B // covers curve2's (θ/2) ramp too
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
      const curve = curveFor(level.track)
      const a = pointAt(curve, 0)
      const b = pointAt(curve, 1)
      expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeLessThan(1e-6)
    }
  })

  it('stays above ground level (y > 0) everywhere', () => {
    for (const level of levels.filter((l) => l.track.curve === 'curve1')) {
      const curve = curveFor(level.track)
      for (let i = 0; i <= SAMPLES; i++) {
        expect(curve.getPointAt(i / SAMPLES).y).toBeGreaterThan(0)
      }
    }
  })
})

describe('TrigCurve2 (curve2)', () => {
  it('has a known vertical seam at t=0/1 of exactly π · varC · scalar', () => {
    // The (angle / 2) altitude ramp is not periodic, so curve2 tracks end higher
    // than they start. Documented here so a change to it is deliberate.
    for (const level of levels.filter((l) => l.track.curve === 'curve2')) {
      const { varC, scalar } = level.track
      const curve = curveFor(level.track)
      const a = pointAt(curve, 0)
      const b = pointAt(curve, 1)
      expect(b.y - a.y).toBeCloseTo(Math.PI * varC * scalar, 6)
    }
  })
})

describe('ProceduralTrackGenerator', () => {
  it('is deterministic per seed and segment', () => {
    const a = generateTrackSegment(1234, 3)
    const b = generateTrackSegment(1234, 3)
    expect([a.varA, a.varB, a.varC, a.scalar]).toEqual([b.varA, b.varB, b.varC, b.scalar])
    expect(pointAt(a.curve, 0.37)).toEqual(pointAt(b.curve, 0.37))
  })

  it('keeps params in documented ranges and curves finite for many seeds', () => {
    for (let seed = 0; seed < 50; seed++) {
      const s = generateTrackSegment(seed, seed % 5)
      expect(s.varA).toBeGreaterThanOrEqual(2)
      expect(s.varA).toBeLessThanOrEqual(7)
      expect(s.varB).toBeGreaterThanOrEqual(10)
      expect(s.varB).toBeLessThanOrEqual(34)
      expect(s.varC).toBeGreaterThanOrEqual(2)
      expect(s.varC).toBeLessThanOrEqual(5)
      expect(s.scalar).toBeGreaterThanOrEqual(20)
      expect(s.scalar).toBeLessThanOrEqual(59)
      for (let i = 0; i <= 100; i++) {
        const p = s.curve.getPointAt(i / 100)
        expect(Number.isFinite(p.x + p.y + p.z)).toBe(true)
      }
    }
  })
})
