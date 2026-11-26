import { describe, expect, it } from 'vitest'
import { BLIMP_HATCH, BLIMP_WEAVE, hatchShut, weaveAcross, weaveUp } from './blimpMotion.hot'

describe('the Golden Blimp fights back (#1059)', () => {
  it('weaves from where it arrives, within its half-widths', () => {
    expect(weaveAcross(0)).toBe(0)
    expect(weaveUp(0)).toBe(0)
    let across = 0
    for (let t = 0; t < 20; t += 0.1) across = Math.max(across, Math.abs(weaveAcross(t)))
    expect(across).toBeGreaterThan(0.9 * BLIMP_WEAVE.across)
    expect(across).toBeLessThanOrEqual(BLIMP_WEAVE.across)
  })

  it('opens the hatch at once, then shuts it between windows', () => {
    expect(hatchShut(0)).toBe(false)
    expect(hatchShut(BLIMP_HATCH.openS - 0.01)).toBe(false)
    expect(hatchShut(BLIMP_HATCH.openS + 0.01)).toBe(true)
    expect(hatchShut(BLIMP_HATCH.period + 0.01)).toBe(false)
  })
})
