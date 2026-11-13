import { describe, expect, it } from 'vitest'
import { dashHeading, newRatPose, RAT, RAT_CYCLE, ratPose } from './ratMotion'

const at = (base: number, t: number) => ratPose(base, t, newRatPose())

describe('ratPose', () => {
  it('starts where it was put, facing its first dash', () => {
    const p = at(0.3, 0)
    expect(p.x).toBe(0)
    expect(p.z).toBe(0)
    expect(p.heading).toBeCloseTo(dashHeading(0.3, 0))
    expect(p.running).toBe(true)
  })

  it('stops dead between dashes', () => {
    const a = at(1, RAT.run + 0.01)
    const b = at(1, RAT_CYCLE - 0.01)
    expect(a.running).toBe(false)
    expect(b.x).toBeCloseTo(a.x)
    expect(b.z).toBeCloseTo(a.z)
    expect(Math.hypot(a.x, a.z)).toBeCloseTo(RAT.dash)
    expect(a.hop).toBe(0)
  })

  it('moves continuously: no jump across a dash or a stop', () => {
    let worst = 0
    let prev = at(2, 0)
    for (let t = 0.002; t < 5 * RAT_CYCLE; t += 0.002) {
      const p = at(2, t)
      worst = Math.max(worst, Math.hypot(p.x - prev.x, p.z - prev.z))
      prev = p
    }
    expect(worst).toBeLessThan((2 * RAT.dash / RAT.run) * 0.0021)
  })

  it('zig-zags left and right of its heading and gets somewhere along it', () => {
    const base = 0.7
    expect(dashHeading(base, 0)).toBeCloseTo(base + RAT.zig)
    expect(dashHeading(base, 1)).toBeCloseTo(base - RAT.zig)
    const p = at(base, 10 * RAT_CYCLE)
    const along = p.x * Math.sin(base) + p.z * Math.cos(base)
    const across = p.x * Math.cos(base) - p.z * Math.sin(base)
    expect(along).toBeCloseTo(10 * RAT.dash * Math.cos(RAT.zig))
    expect(Math.abs(across)).toBeLessThan(1e-6)
  })

  it('twitches its nose harder when stopped, and always swishes its tail', () => {
    const stopped = Array.from({ length: 40 }, (_, i) => Math.abs(at(0, RAT.run + (i / 40) * RAT.stop).nose))
    const running = Array.from({ length: 40 }, (_, i) => Math.abs(at(0, (i / 40) * RAT.run).nose))
    expect(Math.max(...stopped)).toBeGreaterThan(0.9)
    expect(Math.max(...running)).toBeLessThanOrEqual(0.3)
    const tails = Array.from({ length: 40 }, (_, i) => at(0, i * 0.05).tail)
    expect(Math.min(...tails)).toBeLessThan(-0.9)
    expect(Math.max(...tails)).toBeGreaterThan(0.9)
  })

  it('holds still before it starts (a negative time)', () => {
    expect(at(1, -3)).toEqual(at(1, 0))
  })
})
