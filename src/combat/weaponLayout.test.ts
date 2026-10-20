import { describe, it, expect } from 'vitest'
import {
  WEAPON_MAX_TILT, WEAPON_MIN_DEPTH, WEAPON_MIN_TILT, clampWeaponAim, recoilEnvelope, weaponDepth, weaponLayout,
  type WeaponDepth, type WeaponLayout,
} from './weaponLayout'

const layoutOut = (): WeaponLayout => ({ x: 0, y: 0, unitPx: 0 })
const depthOut = (): WeaponDepth => ({ depth: 0, scale: 0 })

const VIEWPORTS: [string, number, number][] = [
  ['desktop', 1280, 720],
  ['portrait', 390, 844],
  ['landscape', 844, 390],
]

describe('weaponLayout', () => {
  for (const [name, w, h] of VIEWPORTS) {
    it(`anchors bottom-right and clear of the centre on ${name}`, () => {
      const out = layoutOut()
      const l = weaponLayout(w, h, out)
      expect(l).toBe(out) // writes into `out`, no allocation
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
        const l = weaponLayout(w, h, layoutOut())
        const { depth, scale } = weaponDepth(l.unitPx, h, fov, depthOut())
        expect(depth).toBeGreaterThanOrEqual(WEAPON_MIN_DEPTH)
        // Back of the gun (0.4 units behind the pivot) stays past near = 1.
        expect(depth - 0.4 * scale).toBeGreaterThan(1)
        // One model unit projects to unitPx at the pivot depth.
        const px = (scale / (2 * Math.tan((fov * Math.PI) / 360) * depth)) * h
        expect(px).toBeCloseTo(l.unitPx)
      }
    }
  })

  it('the gun aims at any point above it, except a narrow cone around straight up', () => {
    const out = { x: 0, y: 0 }
    const deg = (rad: number) => (rad * 180) / Math.PI
    const heading = (px: number, py: number) => Math.atan2(out.x - px, py - out.y)
    for (const [, w, h] of VIEWPORTS) {
      const l = weaponLayout(w, h, layoutOut())
      const minDist = 0.4 * Math.min(w, h)
      // Sample every aim point above the pivot: centre, left and right of it.
      for (let ax = 0; ax <= w; ax += w / 20) {
        for (let ay = 0; ay < l.y - 1; ay += h / 20) {
          clampWeaponAim(l.x, l.y, ax, ay, minDist, out)
          const want = Math.atan2(ax - l.x, l.y - ay)
          const got = heading(l.x, l.y)
          // Within the tilt guard of the real aim, and never closer to vertical.
          expect(Math.abs(deg(got - want))).toBeLessThanOrEqual(deg(WEAPON_MIN_TILT) + 1e-9)
          expect(Math.abs(got)).toBeGreaterThanOrEqual(WEAPON_MIN_TILT - 1e-9)
          // Same distance from the pivot, or pushed out to the minimum.
          const d = Math.hypot(ax - l.x, ay - l.y)
          expect(Math.hypot(out.x - l.x, out.y - l.y)).toBeCloseTo(Math.max(d, minDist))
        }
      }
    }
    // Off the guards, the aim passes through untouched.
    clampWeaponAim(500, 500, 200, 100, 100, out)
    expect(out).toEqual({ x: 200, y: 100 })
    clampWeaponAim(500, 500, 800, 100, 100, out)
    expect(out).toEqual({ x: 800, y: 100 })
    // Close aims keep their heading but move out to the minimum distance.
    clampWeaponAim(500, 500, 470, 460, 100, out)
    expect(out.x).toBeCloseTo(440)
    expect(out.y).toBeCloseTo(420)
    // Never points further down than WEAPON_MAX_TILT.
    clampWeaponAim(500, 500, 500 - 1, 900, 100, out)
    expect(Math.abs(heading(500, 500))).toBeCloseTo(WEAPON_MAX_TILT)
    expect(out.x).toBeLessThan(500)
  })

  it('recoil envelope runs 1 → 0', () => {
    expect(recoilEnvelope(1e6)).toBe(1)
    expect(recoilEnvelope(0)).toBe(0)
    expect(recoilEnvelope(-5)).toBe(0)
  })
})
