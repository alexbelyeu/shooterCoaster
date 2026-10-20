import { describe, expect, it } from 'vitest'
import { fovForAspect, horizontalFov, verticalFovFor, MAX_VERTICAL_FOV, MIN_HORIZONTAL_FOV } from './cameraFov'

describe('cameraFov', () => {
  it('converts between vertical and horizontal FOV', () => {
    expect(horizontalFov(80, 1)).toBeCloseTo(80, 6)
    expect(verticalFovFor(horizontalFov(80, 16 / 9), 16 / 9)).toBeCloseTo(80, 6)
  })

  it('keeps the base FOV on desktop and landscape screens', () => {
    expect(fovForAspect(80, 1280 / 720)).toBe(80)
    expect(fovForAspect(80, 844 / 390)).toBe(80)
    expect(fovForAspect(80, 1)).toBe(80)
  })

  it('widens the vertical FOV in portrait to keep the minimum horizontal FOV', () => {
    const aspect = 390 / 844
    const fov = fovForAspect(80, aspect)
    expect(fov).toBeGreaterThan(80)
    expect(fov).toBeLessThanOrEqual(MAX_VERTICAL_FOV)
    // Close to the target; within a few degrees when the clamp kicks in.
    expect(horizontalFov(fov, aspect)).toBeGreaterThan(MIN_HORIZONTAL_FOV - 4)
    expect(horizontalFov(fov, aspect)).toBeGreaterThan(horizontalFov(80, aspect) + 10)
  })

  it('reaches the minimum exactly when the clamp does not bind', () => {
    const aspect = 0.6 // narrow, but not narrow enough to hit the clamp
    expect(horizontalFov(fovForAspect(80, aspect), aspect)).toBeCloseTo(MIN_HORIZONTAL_FOV, 6)
  })

  it('clamps very narrow screens and ignores invalid aspects', () => {
    expect(fovForAspect(80, 0.2)).toBe(MAX_VERTICAL_FOV)
    expect(fovForAspect(80, 0)).toBe(80)
    expect(fovForAspect(80, Number.NaN)).toBe(80)
    expect(fovForAspect(80, Number.POSITIVE_INFINITY)).toBe(80)
  })
})
