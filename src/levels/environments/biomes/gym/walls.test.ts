import { describe, expect, it } from 'vitest'
import { GYM_SCALE, HALL, PIECES, STAR, pieceAxes, toWorld } from './blockout'
import { GYM_WALLS, chordOf } from './walls'

const cross = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})

describe('gym walls', () => {
  it('stand a profile’s chord off far enough that no panel comes through it', () => {
    const c = chordOf([{ len: 5, angle: 0 }, { len: 7, angle: 12 }, { len: 6, angle: 0 }])
    // The overhang's lip (y ≈ 11.85, 1.46 m out) is the furthest in front of the chord.
    expect(c.forward).toBeCloseTo(7 * Math.sin((12 * Math.PI) / 180), 6)
    expect(c.standoff).toBeGreaterThan(0.4)
    expect(chordOf([{ len: 10, angle: 0 }]).standoff).toBe(0)
  })

  it.each(GYM_WALLS.map((w) => [w.id, w] as const))('%s faces into the hall from its wall, inside its walls', (_id, w) => {
    const piece = PIECES.find((p) => w.id.startsWith(p.id))!
    const { facing } = pieceAxes(piece.rot)
    const n = cross(w.right, w.up)
    expect(n.x * facing.x + n.z * facing.z).toBeGreaterThan(0.9)
    for (const [u, v] of [[0, 0], [w.width, 0], [0, w.height], [w.width, w.height]]) {
      const p = { x: w.origin.x + w.right.x * u + w.up.x * v, z: w.origin.z + w.right.z * u + w.up.z * v, y: w.origin.y + w.up.y * v }
      expect(Math.abs(p.x)).toBeLessThanOrEqual((HALL.w / 2) * GYM_SCALE)
      expect(Math.abs(p.z)).toBeLessThanOrEqual((HALL.d / 2) * GYM_SCALE)
      expect(p.y).toBeLessThanOrEqual(HALL.h * GYM_SCALE)
    }
  })

  it('leave the Starr’s star clear', () => {
    const star = toWorld(STAR.centre)
    for (const w of GYM_WALLS.filter((s) => s.id.startsWith('w-starr'))) {
      const along = (star.x - w.origin.x) * w.right.x + (star.z - w.origin.z) * w.right.z
      expect(along < -STAR.radius * GYM_SCALE || along > w.width + STAR.radius * GYM_SCALE).toBe(true)
    }
  })
})
