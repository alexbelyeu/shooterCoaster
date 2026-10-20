import { describe, it, expect } from 'vitest'
import {
  KILL_TRAUMA_MS, MAX_PITCH_YAW_DEG, MAX_ROLL_DEG,
  addTrauma, decayTrauma, effectiveShakeScale, killTrauma, shakeAngles, smoothNoise1,
  type ShakeAngles, type TraumaState,
} from './screenShake'

const DEG = Math.PI / 180

describe('screenShake', () => {
  it('kill trauma scales with combo and is clamped to 0..1', () => {
    expect(killTrauma(1)).toBeCloseTo(0.55)
    expect(killTrauma(10)).toBe(1)
    expect(killTrauma(99)).toBe(1)
    expect(killTrauma(0)).toBeCloseTo(0.55)
    expect(killTrauma(NaN)).toBeCloseTo(0.55)
    expect(killTrauma(5)).toBeGreaterThan(killTrauma(2))
    // Overlapping kills keep the stronger trauma, never stack past 1.
    expect(addTrauma({ trauma: 0.9, decayMs: KILL_TRAUMA_MS }, killTrauma(1)).trauma).toBe(0.9)
    expect(addTrauma({ trauma: 0.1, decayMs: KILL_TRAUMA_MS }, killTrauma(10)).trauma).toBe(1)
    expect(addTrauma({ trauma: 0, decayMs: KILL_TRAUMA_MS }, 5).trauma).toBe(1)
  })

  it('long world-event trauma decays over its own duration and keeps its tail', () => {
    const s: TraumaState = { trauma: 0, decayMs: KILL_TRAUMA_MS }
    addTrauma(s, 0.8, 3000)
    expect(s.trauma).toBe(0.8)
    expect(s.trauma * s.decayMs).toBeCloseTo(2400) // ms until it reaches 0
    // A stronger kill mid-rumble raises the level but does not cut the rumble short.
    decayTrauma(s, 1000)
    addTrauma(s, killTrauma(10))
    expect(s.trauma).toBe(1)
    expect(s.trauma * s.decayMs).toBeCloseTo(2400 - 1000)
    let elapsed = 0
    while (s.trauma > 0 && elapsed < 10000) {
      decayTrauma(s, 16.7)
      elapsed += 16.7
    }
    expect(s.trauma).toBe(0)
    expect(elapsed).toBeLessThanOrEqual(1400 + 16.7)
  })

  it('decays to exactly 0 within 250 ms at any frame rate', () => {
    for (const dt of [1, 4, 16.7, 33, 100, 1000]) {
      const s: TraumaState = { trauma: 0, decayMs: KILL_TRAUMA_MS }
      addTrauma(s, killTrauma(99))
      let elapsed = 0
      while (s.trauma > 0) {
        decayTrauma(s, dt)
        elapsed += dt
        if (elapsed > 5000) break
      }
      expect(s.trauma).toBe(0)
      expect(elapsed).toBeLessThanOrEqual(Math.max(KILL_TRAUMA_MS + dt, dt))
    }
    expect(KILL_TRAUMA_MS).toBeLessThanOrEqual(250)
  })

  it('angles stay within 0.6° pitch/yaw and 1° roll on full, half on reduced', () => {
    const out: ShakeAngles = { pitch: 0, yaw: 0, roll: 0 }
    let maxPY = 0
    let maxR = 0
    for (let i = 0; i < 5000; i++) {
      shakeAngles(1, i * 0.0037, i % 17, 1, out)
      maxPY = Math.max(maxPY, Math.abs(out.pitch), Math.abs(out.yaw))
      maxR = Math.max(maxR, Math.abs(out.roll))
    }
    expect(maxPY).toBeLessThanOrEqual(MAX_PITCH_YAW_DEG * DEG + 1e-12)
    expect(maxR).toBeLessThanOrEqual(MAX_ROLL_DEG * DEG + 1e-12)
    expect(maxR).toBeGreaterThan(0.3 * MAX_ROLL_DEG * DEG) // actually moves
    shakeAngles(1, 0.123, 3, 0.5, out)
    const half = Math.abs(out.roll)
    shakeAngles(1, 0.123, 3, 1, out)
    expect(half).toBeCloseTo(Math.abs(out.roll) / 2)
  })

  it('is exactly zero with no trauma or shake off', () => {
    const out: ShakeAngles = { pitch: 1, yaw: 1, roll: 1 }
    expect(shakeAngles(0, 1.5, 2, 1, out)).toEqual({ pitch: 0, yaw: 0, roll: 0 })
    out.pitch = 1
    expect(shakeAngles(1, 1.5, 2, 0, out)).toEqual({ pitch: 0, yaw: 0, roll: 0 })
  })

  it('noise is smooth (no high-frequency jumps) and bounded', () => {
    let prev = smoothNoise1(0, 4)
    for (let i = 1; i < 2000; i++) {
      const v = smoothNoise1(i * 0.01, 4)
      expect(Math.abs(v)).toBeLessThanOrEqual(1)
      // Quintic lattice: slope ≤ 1.875 * 2 per lattice unit → ≤ 0.0375 per 0.01 step.
      expect(Math.abs(v - prev)).toBeLessThanOrEqual(0.04)
      prev = v
    }
  })

  it('settings levels map to scales and reduced motion forces off', () => {
    expect(effectiveShakeScale('off', false)).toBe(0)
    expect(effectiveShakeScale('reduced', false)).toBe(0.5)
    expect(effectiveShakeScale('full', false)).toBe(1)
    expect(effectiveShakeScale('full', true)).toBe(0)
  })
})
