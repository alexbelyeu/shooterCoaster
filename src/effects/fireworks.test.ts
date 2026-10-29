import { describe, expect, it } from 'vitest'
import { createRng } from '@/utils/rng'
import {
  FLIGHT_S,
  MAX_PAD_REACH,
  PATTERNS,
  PATTERN_ORDER,
  SPARKS_PER_BURST,
  burstVelocities,
  pickPad,
  rocketsForStreak,
  slotLifetime,
  sparkOffset,
  type Vec3,
} from './fireworks'

const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z })

function velocities(pattern: (typeof PATTERN_ORDER)[number], normal = v3(0, 0, -1), seed = 7) {
  const out = burstVelocities(pattern, createRng(seed), normal, new Float32Array(SPARKS_PER_BURST * 3))
  const list: Vec3[] = []
  for (let i = 0; i < SPARKS_PER_BURST; i++) list.push(v3(out[i * 3], out[i * 3 + 1], out[i * 3 + 2]))
  return list
}

describe('rocketsForStreak', () => {
  it('fires on every 5th consecutive kill, two from 15 on', () => {
    expect([1, 4, 6, 9, 11, 14, 16].map(rocketsForStreak)).toEqual([0, 0, 0, 0, 0, 0, 0])
    expect([5, 10].map(rocketsForStreak)).toEqual([1, 1])
    expect([15, 20, 45].map(rocketsForStreak)).toEqual([2, 2, 2])
  })

  it('ignores bad counts', () => {
    expect([0, -5, NaN, 7.5].map(rocketsForStreak)).toEqual([0, 0, 0, 0])
  })
})

describe('sparkOffset', () => {
  const spec = { drag: 2, gravity: 10 }

  it('starts at the burst point', () => {
    const o = sparkOffset(v3(50, 50, 50), spec, 0, v3(1, 1, 1))
    expect([o.x, o.y, o.z]).toEqual([0, 0, 0])
  })

  it('coasts towards v/drag sideways while gravity keeps pulling down', () => {
    const v = v3(100, 0, -40)
    const late = sparkOffset(v, spec, 20, v3(0, 0, 0))
    expect(late.x).toBeCloseTo(100 / 2, 3)
    expect(late.z).toBeCloseTo(-40 / 2, 3)
    expect(late.y).toBeCloseTo(-0.5 * 10 * 400, 3)
    const early = sparkOffset(v, spec, 0.1, v3(0, 0, 0))
    expect(early.x).toBeGreaterThan(0)
    expect(early.x).toBeLessThan(100 * 0.1)
  })
})

describe('burstVelocities', () => {
  it.each(PATTERN_ORDER)('%s: every spark within its speed band, deterministic for a seed', (pattern) => {
    const { speed, spread } = PATTERNS[pattern]
    const a = velocities(pattern)
    for (const v of a) {
      const s = Math.hypot(v.x, v.y, v.z)
      expect(s).toBeGreaterThanOrEqual(speed * (1 - spread) - 1e-3)
      expect(s).toBeLessThanOrEqual(speed * (1 + spread) + 1e-3)
    }
    expect(velocities(pattern)).toEqual(a)
    expect(velocities(pattern, v3(0, 0, -1), 8)).not.toEqual(a)
  })

  it('peony covers the whole sphere evenly', () => {
    const dirs = velocities('peony')
    const mean = dirs.reduce((m, v) => v3(m.x + v.x, m.y + v.y, m.z + v.z), v3(0, 0, 0))
    expect(Math.hypot(mean.x, mean.y, mean.z) / SPARKS_PER_BURST).toBeLessThan(PATTERNS.peony.speed * 0.05)
    expect(dirs.filter((v) => v.y > 0).length).toBe(SPARKS_PER_BURST / 2)
  })

  it.each([v3(0, 0, -1), v3(0.6, -0.2, 0.77), v3(0, 1, 0)])('ring lies in the plane facing %o', (normal) => {
    const nl = Math.hypot(normal.x, normal.y, normal.z)
    for (const v of velocities('ring', normal)) {
      const dot = (v.x * normal.x + v.y * normal.y + v.z * normal.z) / nl
      expect(Math.abs(dot)).toBeLessThan(1e-3)
    }
  })

  it('writes at the offset only', () => {
    const out = new Float32Array(SPARKS_PER_BURST * 3 * 2)
    burstVelocities('peony', createRng(1), v3(0, 0, -1), out, SPARKS_PER_BURST * 3)
    expect(out.subarray(0, SPARKS_PER_BURST * 3).every((x) => x === 0)).toBe(true)
    expect(out.subarray(SPARKS_PER_BURST * 3).some((x) => x !== 0)).toBe(true)
  })
})

describe('pickPad', () => {
  const cam = v3(0, 50, 0)
  const forward = v3(0, -0.3, -1)
  const burst = v3(0, 130, -320)

  it('takes the pad ahead of the rider nearest the burst', () => {
    const pads = [v3(0, 0, 200), v3(300, 0, -500), v3(-100, 0, -400)]
    expect(pickPad(pads, burst, cam, forward)).toBe(2)
  })

  it('skips pads behind the rider or out of reach', () => {
    expect(pickPad([v3(0, 0, 10)], burst, cam, forward)).toBe(-1)
    expect(pickPad([v3(MAX_PAD_REACH + 10, 0, -320)], burst, cam, forward)).toBe(-1)
    expect(pickPad([], burst, cam, forward)).toBe(-1)
  })
})

describe('slotLifetime', () => {
  it('covers the flight and the burst', () => {
    expect(slotLifetime('willow')).toBeCloseTo(FLIGHT_S + PATTERNS.willow.lifeS)
  })
})
