import { describe, it, expect } from 'vitest'
import { WEAPON_MIN_DEPTH, recoilEnvelope, weaponDepth, weaponLayout } from './weaponLayout'

const VIEWPORTS: [string, number, number][] = [
  ['desktop', 1280, 720],
  ['portrait', 390, 844],
  ['landscape', 844, 390],
]

describe('weaponLayout', () => {
  for (const [name, w, h] of VIEWPORTS) {
    it(`anchors bottom-right and clear of the centre on ${name}`, () => {
      const l = weaponLayout(w, h)
      expect(l.x).toBeGreaterThan(w * 0.5)
      expect(l.x).toBeLessThan(w)
      expect(l.y).toBeGreaterThan(h * 0.6)
      expect(l.y).toBeLessThan(h)
      // Pivot is well away from the centre (where the crosshair lives).
      expect(Math.hypot(l.x - w / 2, l.y - h / 2)).toBeGreaterThan(Math.min(w, h) * 0.3)
      expect(l.unitPx).toBeGreaterThan(50)
    })
  }

  it('keeps the gun beyond the near plane and matches the requested size', () => {
    for (const [, w, h] of VIEWPORTS) {
      for (const fov of [60, 80, 100]) {
        const l = weaponLayout(w, h)
        const { depth, scale } = weaponDepth(l.unitPx, h, fov)
        expect(depth).toBeGreaterThanOrEqual(WEAPON_MIN_DEPTH)
        // Back of the gun (0.4 units behind the pivot) stays past near = 1.
        expect(depth - 0.4 * scale).toBeGreaterThan(1)
        // One model unit projects to unitPx at the pivot depth.
        const px = (scale / (2 * Math.tan((fov * Math.PI) / 360) * depth)) * h
        expect(px).toBeCloseTo(l.unitPx)
      }
    }
  })

  it('recoil envelope runs 1 → 0', () => {
    expect(recoilEnvelope(1e6)).toBe(1)
    expect(recoilEnvelope(0)).toBe(0)
    expect(recoilEnvelope(-5)).toBe(0)
  })
})
