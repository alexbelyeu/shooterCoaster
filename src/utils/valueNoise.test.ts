import { describe, it, expect } from 'vitest'
import { smoothNoise1 } from './valueNoise.hot'

describe('smoothNoise1', () => {
  it('is smooth (no high-frequency jumps) and bounded', () => {
    let prev = smoothNoise1(0, 4)
    let peak = Math.abs(prev)
    let step = 0
    for (let i = 1; i < 2000; i++) {
      const v = smoothNoise1(i * 0.01, 4)
      peak = Math.max(peak, Math.abs(v))
      step = Math.max(step, Math.abs(v - prev))
      prev = v
    }
    expect(peak).toBeLessThanOrEqual(1)
    expect(step).toBeLessThanOrEqual(0.04)
  })
})
