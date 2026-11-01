import { describe, expect, it } from 'vitest'
import {
  PICKUP_ASSIST_WEIGHT, TOUCH_ASSIST_RADIUS_PX, TOUCH_HIT_SCALE, assistRadiusPx, hitScaleFor, pickAssistTarget,
} from './aimAssist'

describe('aim assist', () => {
  const xs = [100, 200, 130]
  const ys = [100, 100, 140]

  it('picks the nearest candidate within the radius', () => {
    expect(pickAssistTarget(105, 105, xs, ys, 3, 44)).toBe(0)
    expect(pickAssistTarget(125, 130, xs, ys, 3, 44)).toBe(2)
    expect(pickAssistTarget(230, 100, xs, ys, 3, 44)).toBe(1) // 30 px off
  })

  it('returns -1 when nothing is close enough, or with no radius', () => {
    expect(pickAssistTarget(300, 300, xs, ys, 3, 44)).toBe(-1)
    expect(pickAssistTarget(100, 100, xs, ys, 3, 0)).toBe(-1)
    expect(pickAssistTarget(100, 100, xs, ys, 0, 44)).toBe(-1)
  })

  it('only considers the first `count` candidates', () => {
    expect(pickAssistTarget(120, 125, xs, ys, 3, 44)).toBe(2)
    expect(pickAssistTarget(120, 125, xs, ys, 2, 44)).toBe(0)
  })

  it('a lighter weight shortens the reach and loses a tie (weapon pickups)', () => {
    const px = [100, 130]
    const py = [100, 100]
    const w = [PICKUP_ASSIST_WEIGHT, 1]
    expect(pickAssistTarget(115, 100, px, py, 2, 44, w)).toBe(1)
    expect(pickAssistTarget(100, 100, px, py, 1, 44, w)).toBe(0)
    expect(pickAssistTarget(100 + 44 * PICKUP_ASSIST_WEIGHT + 1, 100, px, py, 1, 44, w)).toBe(-1)
  })

  it('assists touch only; mouse and pen aim stay exact', () => {
    expect(assistRadiusPx('touch')).toBe(TOUCH_ASSIST_RADIUS_PX)
    expect(assistRadiusPx('mouse')).toBe(0)
    expect(assistRadiusPx('pen')).toBe(0)
    expect(hitScaleFor('touch')).toBe(TOUCH_HIT_SCALE)
    expect(hitScaleFor('mouse')).toBe(1)
    expect(TOUCH_HIT_SCALE).toBeGreaterThan(1)
    expect(TOUCH_HIT_SCALE).toBeLessThan(1.5)
  })
})
