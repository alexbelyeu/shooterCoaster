import { describe, expect, it } from 'vitest'
import {
  PIXEL_FLOOR_FADE_END,
  PIXEL_FLOOR_FADE_START,
  RAIL_PIXEL_FLOOR,
  getTrackDimensions,
  minThicknessPush,
  minWorldRadius,
  pixelFloorAt,
} from './trackDimensions'

const projScale = (fovDeg: number) => 1 / Math.tan((fovDeg * Math.PI) / 360)

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
  const projected = (depth: number) => pixelRadius(rail + minThicknessPush(rail, depth, RAIL_PIXEL_FLOOR, p, 720), depth, p, 720)

  it('leaves the near track untouched (first 100 units at 720 px)', () => {
    let pushed = 0
    for (let depth = 0; depth <= 100; depth += 5) pushed += minThicknessPush(rail, depth, RAIL_PIXEL_FLOOR, p, 720)
    expect(pushed).toBe(0)
  })

  it('holds the full floor out to the fade start, never past it', () => {
    expect(projected(PIXEL_FLOOR_FADE_START)).toBeCloseTo(RAIL_PIXEL_FLOOR.near, 9)
    expect(projected(150)).toBeCloseTo(RAIL_PIXEL_FLOOR.near, 9)
  })

  it('eases the floor down to the far radius by the fade end and holds it beyond', () => {
    expect(projected(PIXEL_FLOOR_FADE_END)).toBeCloseTo(RAIL_PIXEL_FLOOR.far, 9)
    expect(projected(5000)).toBeCloseTo(RAIL_PIXEL_FLOOR.far, 9)
    const mid = projected((PIXEL_FLOOR_FADE_START + PIXEL_FLOOR_FADE_END) / 2)
    expect(mid).toBeCloseTo((RAIL_PIXEL_FLOOR.near + RAIL_PIXEL_FLOOR.far) / 2, 9)
  })

  it('thins monotonically across the fade', () => {
    let prev = Infinity
    let rising = 0
    for (let depth = PIXEL_FLOOR_FADE_START; depth <= PIXEL_FLOOR_FADE_END; depth += 50) {
      const px = pixelFloorAt(RAIL_PIXEL_FLOOR, depth)
      if (px > prev) rising++
      prev = px
    }
    expect(rising).toBe(0)
  })
})
