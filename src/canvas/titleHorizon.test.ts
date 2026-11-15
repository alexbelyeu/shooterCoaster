import { describe, expect, it } from 'vitest'
import { GROUND_SIZE, GROUND_Y } from './titlePark'
import { CAMERA_FAR, HILL_ROWS, HILL_SEGMENTS, HORIZON_FOG, buildHillGrid, buildTitleHorizon, hillHeight } from './titleHorizon'

const horizon = buildTitleHorizon()
const ANGLES = Array.from({ length: 720 }, (_, i) => (i / 720) * Math.PI * 2)
const ridges = [2, 4, 6]
/** The highest the title camera gets: the orbit's top, the chase over the coaster's hill, a blend's lift. */
const EYE_MAX = 100

describe('title horizon', () => {
  it('is the same horizon every load', () => {
    const again = buildTitleHorizon()
    expect(again.rides.positions).toEqual(horizon.rides.positions)
    expect(again.skyline.lights).toEqual(horizon.skyline.lights)
  })

  it('tucks its inner edge under the park ground and stands every row beyond it above the ground', () => {
    expect(HILL_ROWS[0].r).toBeLessThan(GROUND_SIZE / 2)
    const lows = HILL_ROWS.map((_, k) => Math.min(...ANGLES.map((a) => hillHeight(k, a))))
    expect(Math.max(...ANGLES.map((a) => hillHeight(0, a)))).toBeLessThan(GROUND_Y)
    expect(Math.min(...lows.slice(1))).toBeGreaterThan(GROUND_Y + 3)
  })

  it('stacks its ridges: each stands higher in view than the one before, the last above every camera', () => {
    const elevation = (k: number, a: number) => (hillHeight(k, a) - EYE_MAX / 2) / HILL_ROWS[k].r
    const stacked = ANGLES.filter((a) => elevation(ridges[2], a) > elevation(ridges[1], a) && elevation(ridges[1], a) > elevation(ridges[0], a))
    expect(stacked.length / ANGLES.length).toBeGreaterThan(0.75)
    expect(Math.min(...ANGLES.map((a) => hillHeight(ridges[2], a)))).toBeGreaterThan(EYE_MAX)
  })

  it('stays inside the camera, under fog that starts past the park', () => {
    const last = HILL_ROWS[HILL_ROWS.length - 1].r
    expect(last + 220).toBeLessThan(CAMERA_FAR)
    expect(HORIZON_FOG.far).toBeGreaterThan(last)
    expect(HORIZON_FOG.near).toBeGreaterThanOrEqual(330)
  })

  it('fits the title triangle budget with room to spare', () => {
    const hills = buildHillGrid().index.length / 3
    expect(hills).toBe((HILL_ROWS.length - 1) * HILL_SEGMENTS * 2)
    expect(hills + horizon.rides.triangles + horizon.skyline.triangles).toBeLessThan(4000)
    expect((horizon.rides.lights.length + horizon.skyline.lights.length) / 3).toBeGreaterThan(300)
  })
})
