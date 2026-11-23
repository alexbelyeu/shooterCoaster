import { describe, expect, it } from 'vitest'
import { createRng } from '@/utils/rng'
import { leashedHeading, leashedTurnRate, orbitStep, WANDER_LEASH } from './wanderLeash.hot'

/** Farthest an orbit wander gets from where it started over two minutes of jittery frames. */
function farthestOrbit(speed: number, theta: number, start: number): number {
  const rng = createRng(7)
  const pos = { x: 0, z: 0 }
  let far = 0
  for (let time = start; time < start + 120; ) {
    const delta = (1 + rng()) / 60
    time += delta
    orbitStep(pos, time, delta * 60, speed, theta)
    far = Math.max(far, Math.hypot(pos.x, pos.z))
  }
  return far
}

describe('wander leash (#210)', () => {
  it('fits every trackside orbit inside the leash, wherever it starts', () => {
    // The slowest turn at the fastest pace of each orbiting type: snowman, brute, scout, lava golem.
    const worst = [[3, 0.5], [1.4, 0.3], [5, 1], [1.8, 0.3]].flatMap(([speed, theta]) =>
      [0, 3.7, 41].map((start) => farthestOrbit(speed, leashedTurnRate(speed, theta), start) / WANDER_LEASH),
    )
    expect(Math.max(...worst)).toBeLessThan(1.01)
    // The old orbits did not: a slow-turning snowman's circle was well over a thousand units across.
    expect(farthestOrbit(3, 0.5, 0)).toBeGreaterThan(3 * WANDER_LEASH)
  })

  it('keeps an orbit that already fits as it was', () => {
    expect(leashedTurnRate(1, 2)).toBe(2)
  })

  it('turns a walker home only once it is past the leash', () => {
    const home = { x: 100, z: 100 }
    expect(leashedHeading({ x: 100 + WANDER_LEASH - 1, z: 100 }, home, 0.3)).toBe(0.3)
    expect(leashedHeading({ x: 100 + WANDER_LEASH + 1, z: 100 }, home, 0.3)).toBeCloseTo(Math.PI)
    expect(leashedHeading({ x: 100, z: 100 - WANDER_LEASH - 1 }, home, 0.3)).toBeCloseTo(Math.PI / 2)
  })
})
