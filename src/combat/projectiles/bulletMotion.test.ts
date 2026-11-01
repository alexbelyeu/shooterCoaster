import { describe, expect, it } from 'vitest'
import {
  BULLET_SPEED_PER_SEC, MAX_BULLET_STEP_SEC, hasHit, recordHit, resetPierce, segmentHitsSphere, stepBullet, type PierceState,
} from './bulletMotion'

/** Simulate `seconds` of flight at a fixed frame rate; return the distance covered. */
function flyFor(seconds: number, fps: number): number {
  const pos = { x: 0, y: 0, z: 0 }
  const dir = { x: 0, y: 0.6, z: -0.8 }
  const frames = Math.round(seconds * fps)
  for (let i = 0; i < frames; i++) stepBullet(pos, dir, BULLET_SPEED_PER_SEC, 1 / fps)
  return Math.hypot(pos.x, pos.y, pos.z)
}

describe('stepBullet', () => {
  it('covers the same distance per second at 20, 30 and 60 fps', () => {
    const at60 = flyFor(1, 60)
    expect(at60).toBeCloseTo(BULLET_SPEED_PER_SEC, 6)
    expect(flyFor(1, 20)).toBeCloseTo(at60, 6)
    expect(flyFor(1, 30)).toBeCloseTo(at60, 6)
    expect(flyFor(2, 20)).toBeCloseTo(2 * at60, 6)
  })

  it('keeps the old 14 units per frame at 60 fps', () => {
    const pos = { x: 0, y: 0, z: 0 }
    stepBullet(pos, { x: 0, y: 0, z: -1 }, BULLET_SPEED_PER_SEC, 1 / 60)
    expect(pos.z).toBeCloseTo(-14, 6)
  })

  it('clamps a stall-sized delta and ignores negative ones', () => {
    const pos = { x: 0, y: 0, z: 0 }
    stepBullet(pos, { x: 1, y: 0, z: 0 }, 100, 10)
    expect(pos.x).toBeCloseTo(100 * MAX_BULLET_STEP_SEC, 6)
    stepBullet(pos, { x: 1, y: 0, z: 0 }, 100, -1)
    expect(pos.x).toBeCloseTo(100 * MAX_BULLET_STEP_SEC, 6)
  })
})

describe('segmentHitsSphere', () => {
  it('hits a sphere the segment passes through, even if both ends are outside it', () => {
    // A 500-unit step (a slow frame) straight through a radius-10 target at z=-250.
    expect(segmentHitsSphere(0, 0, 0, 0, 0, -500, 0, 0, -250, 100)).toBe(true)
  })

  it('misses a sphere beside the path', () => {
    expect(segmentHitsSphere(0, 0, 0, 0, 0, -500, 11, 0, -250, 100)).toBe(false)
    expect(segmentHitsSphere(0, 0, 0, 0, 0, -500, 9, 0, -250, 100)).toBe(true)
  })

  it('only counts the swept segment, not the infinite line', () => {
    expect(segmentHitsSphere(0, 0, 0, 0, 0, -100, 0, 0, -150, 100)).toBe(false) // ahead
    expect(segmentHitsSphere(0, 0, 0, 0, 0, -100, 0, 0, 50, 100)).toBe(false) // behind
    expect(segmentHitsSphere(0, 0, 0, 0, 0, -100, 0, 0, -105, 100)).toBe(true) // end inside
  })

  it('degenerates to a point test for a zero-length segment', () => {
    expect(segmentHitsSphere(1, 2, 3, 1, 2, 3, 1, 2, 5, 9)).toBe(true)
    expect(segmentHitsSphere(1, 2, 3, 1, 2, 3, 1, 2, 7, 9)).toBe(false)
  })
})

describe('piercing', () => {
  const bullet = (): PierceState<string> => ({ pierce: 1, hitCount: 0, hitTargets: [null, null, null] })

  it('a normal bullet is spent on its first hit', () => {
    const b = bullet()
    resetPierce(b, 1)
    expect(recordHit(b, 'a')).toBe(true)
  })

  it('a piercing bullet hits 3 distinct targets, never the same one twice', () => {
    const b = bullet()
    resetPierce(b, 3)
    expect(recordHit(b, 'a')).toBe(false)
    expect(hasHit(b, 'a')).toBe(true)
    expect(hasHit(b, 'b')).toBe(false)
    expect(recordHit(b, 'b')).toBe(false)
    expect(recordHit(b, 'c')).toBe(true)
  })

  it('a reused bullet forgets its old targets', () => {
    const b = bullet()
    resetPierce(b, 3)
    recordHit(b, 'a')
    resetPierce(b, 1)
    expect(hasHit(b, 'a')).toBe(false)
    expect(b.hitTargets).toEqual([null, null, null])
  })

  it('never pierces more than the hit list holds', () => {
    const b = bullet()
    resetPierce(b, 9)
    expect(b.pierce).toBe(3)
  })
})
