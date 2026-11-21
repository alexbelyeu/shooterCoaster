import { describe, expect, it } from 'vitest'
import { bankedTurn } from './elements'
import { climbingStraight, climbingTurn, gradeFor, straightTo, trimUnrolledUps } from './climbing'
import { RideBuilder } from './rideBuilder'

const EYE = 1
const start = () => new RideBuilder({ x: 0, y: 0, z: 0, eyeHeight: EYE, spacing: 0.25 })

describe('climbing pieces (#757)', () => {
  it('gradeFor solves the grade over ground (tan) or track (sin), either way up', () => {
    for (const rise of [-3, -0.5, 0.5, 3]) {
      const g = gradeFor(20, rise, 2)
      expect(Math.sign(rise) * 2 * 2 * (1 - Math.cos(g)) + 20 * Math.tan(g)).toBeCloseTo(rise, 6)
      const t = gradeFor(20, rise, 2, 'track')
      expect(Math.sign(rise) * 2 * 2 * (1 - Math.cos(t)) + 20 * Math.sin(t)).toBeCloseTo(rise, 6)
      expect(Math.sign(g)).toBe(Math.sign(rise))
    }
  })

  it('a climbing straight covers its ground, climbs its rise and comes out level on its heading', () => {
    for (const [run, rise] of [
      [12, 2],
      [12, -3],
      [3, 2.5], // steeper than the pitches allow at their radius: they tighten
    ]) {
      const b = climbingStraight(start(), run, { rise, ease: 2 })
      expect(b.position.z).toBeCloseTo(run, 3)
      expect(b.position.y).toBeCloseTo(rise, 3)
      expect(b.position.x).toBeCloseTo(0, 6)
      expect(b.forward.z).toBeCloseTo(1, 6)
    }
    expect(climbingStraight(start(), 5).position.y).toBe(0)
  })

  it("throws when the run can't make the rise, rather than tightening forever (#815)", () => {
    expect(() => climbingStraight(start(), 0.5, { rise: 4 })).toThrow("can't climb 4 over 0.5")
    expect(() => climbingStraight(start(), 0, { rise: -1 })).toThrow("can't climb -1 over 0")
    const b = start()
    expect(() => straightTo(b, 'z', b.position.z, { rise: 1 })).toThrow("can't climb 1 over 0")
    expect(climbingStraight(start(), 1, { rise: 5 }).position.y).toBeCloseTo(5, 3) // steep, but under tan 1.4
  })

  it('a straight to a line on the plan stops on it', () => {
    const b = start()
    straightTo(b, 'z', 9, { rise: 1.5 })
    expect(b.position.z).toBeCloseTo(9, 3)
    expect(b.position.y).toBeCloseTo(1.5, 3)
  })

  it("a climbing turn keeps the level turn's heading and climbs by its grade solved over the turn's length", () => {
    const level = climbingTurn(start(), Math.PI / 2, 4)
    const angle = Math.PI / 2
    for (const rise of [1, -1.5]) {
      const b = climbingTurn(start(), angle, 4, { rise, ease: 1 })
      expect(b.forward.distanceTo(level.forward)).toBeLessThan(1e-6)
      const g = gradeFor(angle * 4, rise, 1, 'track')
      expect(b.position.y).toBeCloseTo(Math.sign(rise) * 2 * (1 - Math.cos(g)) + angle * 4 * Math.tan(g), 3)
      expect(Math.abs(b.position.y)).toBeGreaterThanOrEqual(Math.abs(rise))
    }
  })

  it('a banked turn climbs with `rise`, marked as one span, and banks into the turn', () => {
    const b = bankedTurn(start(), { angle: -Math.PI / 2, radius: 4, rise: 1, bank: 0.5 })
    expect(b.markers.map((m) => m.kind)).toEqual(['bankedTurn'])
    expect(b.position.y).toBeGreaterThan(1)
    const middle = b.points[Math.round(b.points.length / 2)].up!
    expect(Math.acos(middle.y)).toBeGreaterThan(0.4)
  })

  it("trims the ups a spline works out anyway, keeps a roll's and a steep track's", () => {
    const flat = trimUnrolledUps([
      { x: 0, y: 0, z: 0, up: { x: 0, y: 1, z: 0 } },
      { x: 0, y: 0, z: 1, up: { x: 0, y: 1, z: 0 } },
      { x: 0, y: 0, z: 2, up: { x: Math.sin(0.3), y: Math.cos(0.3), z: 0 } },
      { x: 0, y: 0, z: 3 },
    ])
    expect(flat.map((p) => !!p.up)).toEqual([false, false, true, false])
    const steep = trimUnrolledUps([
      { x: 0, y: 0, z: 0, up: { x: 0, y: 0, z: -1 } },
      { x: 0, y: 2, z: 0.1, up: { x: 0, y: 0, z: -1 } },
      { x: 0, y: 4, z: 0.2, up: { x: 0, y: 0, z: -1 } },
    ])
    expect(steep.every((p) => p.up)).toBe(true)
  })
})
