import { describe, it, expect } from 'vitest'
import {
  WEAPON_MAX_TILT, WEAPON_MIN_AIM_DIST, WEAPON_MIN_DEPTH, WEAPON_MIN_TILT, clampWeaponAim, recoilEnvelope, weaponDepth, weaponLayout,
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
      expect(l).toBe(out)
      expect(l.x).toBeGreaterThan(w * 0.5)
      expect(l.x).toBeLessThan(w)
      expect(l.y).toBeGreaterThan(h * 0.6)
      expect(l.y).toBeLessThan(h)
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
        expect(depth - 0.4 * scale).toBeGreaterThan(1)
        const px = (scale / (2 * Math.tan((fov * Math.PI) / 360) * depth)) * h
        expect(px).toBeCloseTo(l.unitPx)
      }
    }
  })

  it('the gun heads within WEAPON_MIN_TILT of any aim above it, at least WEAPON_MIN_AIM_DIST away', () => {
    const out = { x: 0, y: 0 }
    const deg = (rad: number) => (rad * 180) / Math.PI
    const heading = (px: number, py: number) => Math.atan2(out.x - px, py - out.y)
    for (const [, w, h] of VIEWPORTS) {
      const l = weaponLayout(w, h, layoutOut())
      const minDist = WEAPON_MIN_AIM_DIST * Math.min(w, h)
      for (let ax = 0; ax <= w; ax += w / 20) {
        for (let ay = 0; ay < l.y - 1; ay += h / 20) {
          clampWeaponAim(l.x, l.y, ax, ay, minDist, out)
          const want = Math.atan2(ax - l.x, l.y - ay)
          const got = heading(l.x, l.y)
          expect(Math.abs(deg(got - want))).toBeLessThanOrEqual(deg(WEAPON_MIN_TILT) + 1e-9)
          expect(Math.abs(got)).toBeGreaterThanOrEqual(WEAPON_MIN_TILT - 1e-9)
          const d = Math.hypot(ax - l.x, ay - l.y)
          expect(Math.hypot(out.x - l.x, out.y - l.y)).toBeCloseTo(Math.max(d, minDist))
        }
      }
    }
  })

  it('clampWeaponAim passes far aims through, pushes close ones out, and never points down past WEAPON_MAX_TILT', () => {
    const out = { x: 0, y: 0 }
    const heading = (px: number, py: number) => Math.atan2(out.x - px, py - out.y)
    clampWeaponAim(500, 500, 200, 100, 100, out)
    expect(out).toEqual({ x: 200, y: 100 })
    clampWeaponAim(500, 500, 800, 100, 100, out)
    expect(out).toEqual({ x: 800, y: 100 })
    clampWeaponAim(500, 500, 470, 460, 100, out)
    expect(out.x).toBeCloseTo(440)
    expect(out.y).toBeCloseTo(420)
    clampWeaponAim(500, 500, 500 - 1, 900, 100, out)
    expect(Math.abs(heading(500, 500))).toBeCloseTo(WEAPON_MAX_TILT)
    expect(out.x).toBeLessThan(500)
  })

  it('portrait: the gun, reaching 0.24 of the short side below its pivot, clears the 94 px bottom HUD row (#223)', () => {
    const rowTop = 16 + 78
    for (const [w, h] of [[320, 568], [360, 780], [375, 667], [390, 844], [430, 932]]) {
      const l = weaponLayout(w, h, layoutOut())
      expect(l.y + 0.24 * w).toBeLessThan(h - rowTop)
    }
  })

  it('recoil envelope runs 1 → 0', () => {
    expect(recoilEnvelope(1e6)).toBe(1)
    expect(recoilEnvelope(0)).toBe(0)
    expect(recoilEnvelope(-5)).toBe(0)
  })
})
