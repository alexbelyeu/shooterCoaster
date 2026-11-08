import { describe, expect, it } from 'vitest'
import { CAR_SPACING, CARS, TRACK_RADIUS, createTitleRide, trainSpeed } from './titleCoaster'
import type { Vec3 } from './titleCamera'

const ride = createTitleRide()
const p: Vec3 = [0, 0, 0]

describe('title coaster', () => {
  it('closes its loop', () => {
    const a = ride.curve.getPointAt(0).clone()
    const b = ride.curve.getPointAt(1)
    expect(a.distanceTo(b)).toBeLessThan(1e-6)
  })

  it('clears the tents, the camera orbit and the ground', () => {
    for (let d = 0; d < ride.table.length; d += 2) {
      ride.pointAt(d, p)
      const r = Math.hypot(p[0], p[2])
      // Tents reach r 138; the cars are ~6 wide on a 3.2 gauge.
      expect(r).toBeGreaterThan(144)
      expect(r).toBeLessThan(170)
      expect(p[1]).toBeGreaterThan(7)
    }
    expect(TRACK_RADIUS).toBeLessThan(180)
  })

  it('runs under the Ferris wheel (x 50, plane z -75): below its gondolas, clear of its legs', () => {
    for (let d = 0; d < ride.table.length; d += 0.5) {
      ride.pointAt(d, p)
      if (Math.abs(p[2] + 75) > 10 || p[0] < 0) continue
      const dx = Math.max(0, Math.abs(p[0] - 50) - 4)
      // Rim (radius 80, hub 90); a gondola hangs 14.5 under it, the train stands ~5 tall.
      expect(p[1] + 5 + 14.5 + 3).toBeLessThan(90 - Math.sqrt(Math.max(0, 80 * 80 - dx * dx)))
      // The near legs reach the ground at x 78 and lean in to the hub.
      expect(p[0]).toBeGreaterThan(78 - 28 * (p[1] / 90) + 10)
    }
  })

  it('is slow over the crests and fast in the dips', () => {
    expect(trainSpeed(40, 40)).toBeLessThan(trainSpeed(10, 40))
    expect(ride.lapS).toBeGreaterThan(20)
    expect(ride.lapS).toBeLessThan(60)
  })

  it('moves the train forward continuously, across laps', () => {
    let prev = ride.leadDistance(0)
    for (let t = 1 / 60; t < ride.lapS * 2.5; t += 1 / 60) {
      const d = ride.leadDistance(t)
      expect(d).toBeGreaterThan(prev)
      expect(d - prev).toBeLessThan(1)
      prev = d
    }
  })

  it('keeps the train shorter than a hill', () => {
    expect(CARS * CAR_SPACING).toBeLessThan(ride.table.length / 10)
  })
})
