import { describe, expect, it } from 'vitest'
import {
  BANK_RESPONSE, LATERAL_ACCEL_REF, MAX_BANK_DEG, MAX_LOOK_AHEAD_DEG, MAX_PITCH_DEG,
  bankAngle, createRigState, damp, dropAmount, lookAheadDirection, pitchAngle, resetRig, smoothingFactor, stepRig,
} from './cameraRig'

const DEG = Math.PI / 180

const angleBetween = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
  Math.acos(Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z)) / DEG

describe('smoothing', () => {
  it('is frame-rate independent: two half steps equal one full step', () => {
    const one = damp(0, 1, BANK_RESPONSE, 0.1)
    const two = damp(damp(0, 1, BANK_RESPONSE, 0.05), 1, BANK_RESPONSE, 0.05)
    expect(two).toBeCloseTo(one, 12)
  })

  it('holds still on a frozen frame and never overshoots on a long one', () => {
    expect(smoothingFactor(0, 5)).toBe(0)
    expect(smoothingFactor(-1, 5)).toBe(0)
    expect(smoothingFactor(10, 5)).toBeLessThanOrEqual(1)
    expect(damp(0, 1, 5, 10)).toBeLessThanOrEqual(1)
  })
})

describe('bank and pitch', () => {
  it('rolls toward the inside of the turn', () => {
    // Left turn: acceleration points left (negative along the right axis) -> positive rotateZ.
    expect(bankAngle(-100, 1)).toBeGreaterThan(0)
    expect(bankAngle(100, 1)).toBeLessThan(0)
    expect(bankAngle(0, 1)).toBeCloseTo(0, 12)
  })

  it('saturates at the cap and scales with the track', () => {
    expect(Math.abs(bankAngle(1e9, 1))).toBeCloseTo(MAX_BANK_DEG * DEG, 9)
    expect(Math.abs(bankAngle(LATERAL_ACCEL_REF, 1))).toBeCloseTo(Math.tanh(1) * MAX_BANK_DEG * DEG, 9)
    expect(bankAngle(2 * LATERAL_ACCEL_REF, 2)).toBeCloseTo(bankAngle(LATERAL_ACCEL_REF, 1), 12)
    expect(bankAngle(Number.NaN, 1)).toBe(0)
  })

  it('pitches up when speeding up and down when braking, within the cap', () => {
    expect(pitchAngle(100, 1)).toBeGreaterThan(0)
    expect(pitchAngle(-100, 1)).toBeLessThan(0)
    expect(Math.abs(pitchAngle(-1e9, 1))).toBeCloseTo(MAX_PITCH_DEG * DEG, 9)
    expect(pitchAngle(Number.POSITIVE_INFINITY, 1)).toBe(0)
  })
})

describe('dropAmount', () => {
  it('is 0 on the flat and climbs, 1 on steep drops, monotonic in between', () => {
    expect(dropAmount(0)).toBe(0)
    expect(dropAmount(-0.5)).toBe(0)
    expect(dropAmount(0.05)).toBe(0)
    expect(dropAmount(0.45)).toBe(1)
    expect(dropAmount(0.9)).toBe(1)
    expect(dropAmount(Number.NaN)).toBe(0)
    let prev = 0
    for (let d = 0; d <= 0.5; d += 0.01) {
      expect(dropAmount(d)).toBeGreaterThanOrEqual(prev)
      prev = dropAmount(d)
    }
  })
})

describe('stepRig', () => {
  it('eases into a sustained turn and settles at its bank angle', () => {
    const s = createRigState()
    stepRig(s, -150, 100, 0.5, 1 / 60, 1)
    expect(s.roll).toBeGreaterThan(0)
    expect(s.roll).toBeLessThan(bankAngle(-150, 1) / 2)
    for (let i = 0; i < 600; i++) stepRig(s, -150, 100, 0.5, 1 / 60, 1)
    expect(s.roll).toBeCloseTo(bankAngle(-150, 1), 6)
    expect(s.pitch).toBeCloseTo(0, 6) // constant speed
    expect(s.speedNorm).toBeCloseTo(0.5, 6)
  })

  it('pitches from the change in speed, not the speed itself', () => {
    const s = createRigState()
    stepRig(s, 0, 100, 0, 1 / 60, 1) // first frame after a reset: no acceleration yet
    expect(s.pitch).toBe(0)
    for (let i = 1; i <= 60; i++) stepRig(s, 0, 100 + i * 2, 0, 1 / 60, 1) // +120 units/s²
    expect(s.pitch).toBeGreaterThan(0)
    expect(s.pitch).toBeLessThanOrEqual(MAX_PITCH_DEG * DEG)
  })

  it('eases toward the drop amount of the current descent', () => {
    const s = createRigState()
    for (let i = 0; i < 600; i++) stepRig(s, 0, 100, 0, 1 / 60, 1, 0.6)
    expect(s.drop).toBeCloseTo(1, 6)
    for (let i = 0; i < 600; i++) stepRig(s, 0, 100, 0, 1 / 60, 1, -0.3)
    expect(s.drop).toBeCloseTo(0, 6)
  })

  it('is untouched by frozen frames and cleared by a reset', () => {
    const s = createRigState()
    for (let i = 0; i < 30; i++) stepRig(s, 200, 100 + i, 1, 1 / 60, 1, 0.5)
    const before = { ...s }
    stepRig(s, -500, 0, 0, 0, 1)
    expect(s).toEqual(before)
    resetRig(s)
    expect(s).toEqual(createRigState())
  })
})

describe('lookAheadDirection', () => {
  it('looks straight along the tangent on a straight track', () => {
    const out = { x: 0, y: 0, z: 0 }
    lookAheadDirection({ x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: -1 }, out)
    expect(out).toEqual({ x: 0, y: 0, z: -1 })
  })

  it('glances part way into a gentle curve', () => {
    const ahead = { x: Math.sin(10 * DEG), y: 0, z: -Math.cos(10 * DEG) }
    const out = lookAheadDirection({ x: 0, y: 0, z: -1 }, ahead, { x: 0, y: 0, z: 0 })
    expect(Math.hypot(out.x, out.y, out.z)).toBeCloseTo(1, 12)
    expect(out.x).toBeGreaterThan(0)
    expect(angleBetween(out, { x: 0, y: 0, z: -1 })).toBeCloseTo(5, 6)
  })

  it('never turns more than the cap off the tangent', () => {
    const tangent = { x: 0, y: 0, z: -1 }
    const ahead = { x: 1, y: 0, z: 0 } // 90° turn
    const out = lookAheadDirection(tangent, ahead, { x: 0, y: 0, z: 0 })
    expect(angleBetween(out, tangent)).toBeCloseTo(MAX_LOOK_AHEAD_DEG, 6)
    expect(out.x).toBeGreaterThan(0)
  })

  it('may write into its own input', () => {
    const v = { x: Math.sin(10 * DEG), y: 0, z: -Math.cos(10 * DEG) }
    lookAheadDirection({ x: 0, y: 0, z: -1 }, v, v)
    expect(angleBetween(v, { x: 0, y: 0, z: -1 })).toBeCloseTo(5, 6)
  })
})
