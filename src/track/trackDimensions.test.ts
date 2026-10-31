import { describe, expect, it } from 'vitest'
import {
  RAIL_MIN_PIXEL_RADIUS,
  getTrackDimensions,
  minThicknessPush,
  minWorldRadius,
} from './trackDimensions'

/** 1 / tan(fovY / 2) for a vertical FOV in degrees. */
const projScale = (fovDeg: number) => 1 / Math.tan((fovDeg * Math.PI) / 360)

/** Projected radius in pixels of a part `radius` thick at `depth` (what the floor guarantees). */
const pixelRadius = (radius: number, depth: number, p: number, h: number) => (radius * p * h) / (2 * depth)

describe('minWorldRadius', () => {
  it('projects back to the pixel floor at any depth', () => {
    for (const depth of [10, 200, 1500]) {
      const r = minWorldRadius(depth, 1.5, projScale(70), 720)
      expect(pixelRadius(r, depth, projScale(70), 720)).toBeCloseTo(1.5, 9)
    }
  })

  it('grows linearly with depth and is zero at or behind the camera', () => {
    const p = projScale(70)
    expect(minWorldRadius(800, 1.5, p, 720)).toBeCloseTo(2 * minWorldRadius(400, 1.5, p, 720), 9)
    expect(minWorldRadius(0, 1.5, p, 720)).toBe(0)
    expect(minWorldRadius(-5, 1.5, p, 720)).toBe(0)
  })

  it('needs a larger world radius for a wider FOV (portrait) or a shorter viewport', () => {
    expect(minWorldRadius(500, 1.5, projScale(95), 720)).toBeGreaterThan(minWorldRadius(500, 1.5, projScale(70), 720))
    expect(minWorldRadius(500, 1.5, projScale(70), 360)).toBeGreaterThan(minWorldRadius(500, 1.5, projScale(70), 720))
  })
})

describe('minThicknessPush', () => {
  const p = projScale(70)
  const rail = getTrackDimensions({ scalar: 20 }).railRadius

  it('leaves the near track untouched (first 100 units at 720 px)', () => {
    for (let depth = 0; depth <= 100; depth += 5) {
      expect(minThicknessPush(rail, depth, RAIL_MIN_PIXEL_RADIUS, p, 720)).toBe(0)
    }
  })

  it('tops a far rail up to the floor, never past it', () => {
    const depth = 1000
    const push = minThicknessPush(rail, depth, RAIL_MIN_PIXEL_RADIUS, p, 720)
    expect(push).toBeGreaterThan(0)
    expect(pixelRadius(rail + push, depth, p, 720)).toBeCloseTo(RAIL_MIN_PIXEL_RADIUS, 9)
  })
})
