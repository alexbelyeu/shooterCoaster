import { describe, expect, it } from 'vitest'
import {
  BULLET_MAX_SCREEN_FRAC, BULLET_MERGE_DIST, BULLET_RADIUS_PER_SIZE, drawnBulletRadius, muzzleOffsetWeight,
  screenRadiusFraction,
} from './bulletVisual'
import { BULLET_SPEED_PER_SEC } from './bulletMotion'

const TAN_HALF = Math.tan((75 * Math.PI) / 360)
const ANTARCTICA = 40 * BULLET_RADIUS_PER_SIZE

describe('muzzleOffsetWeight', () => {
  it('starts at the muzzle and reaches the hit-test ray at the merge distance', () => {
    expect(muzzleOffsetWeight(0)).toBe(1)
    expect(muzzleOffsetWeight(-5)).toBe(1)
    expect(muzzleOffsetWeight(BULLET_MERGE_DIST / 2)).toBeCloseTo(0.5, 9)
    expect(muzzleOffsetWeight(BULLET_MERGE_DIST)).toBe(0)
    expect(muzzleOffsetWeight(BULLET_MERGE_DIST * 10)).toBe(0)
  })

  it('merges within a quarter second of flight', () => {
    expect(BULLET_MERGE_DIST / BULLET_SPEED_PER_SEC).toBeLessThan(0.25)
  })
})

describe('drawnBulletRadius', () => {
  it('never covers more than the cap, at any depth, for the biggest level bullet', () => {
    for (const depth of [0.5, 1, 2.6, 3, 10, 40, 100, 200, 1000]) {
      const r = drawnBulletRadius(ANTARCTICA, depth, TAN_HALF)
      expect(screenRadiusFraction(r, depth, TAN_HALF)).toBeLessThanOrEqual(BULLET_MAX_SCREEN_FRAC + 1e-12)
    }
  })

  it('is full size once far enough away (Antarctica still reads as snowballs in flight)', () => {
    expect(drawnBulletRadius(ANTARCTICA, 400, TAN_HALF)).toBe(ANTARCTICA)
    expect(drawnBulletRadius(10 * BULLET_RADIUS_PER_SIZE, 60, TAN_HALF)).toBe(1)
  })

  it('grows as the bullet flies off', () => {
    const near = drawnBulletRadius(ANTARCTICA, 3, TAN_HALF)
    const mid = drawnBulletRadius(ANTARCTICA, 50, TAN_HALF)
    expect(near).toBeGreaterThan(0)
    expect(near).toBeLessThan(mid)
    expect(mid).toBeLessThan(ANTARCTICA)
  })

  it('draws nothing at or behind the lens', () => {
    expect(drawnBulletRadius(ANTARCTICA, 0, TAN_HALF)).toBe(0)
    expect(drawnBulletRadius(ANTARCTICA, -2, TAN_HALF)).toBe(0)
    expect(screenRadiusFraction(1, 0, TAN_HALF)).toBe(Infinity)
  })
})
