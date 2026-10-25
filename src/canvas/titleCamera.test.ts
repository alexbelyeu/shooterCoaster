import { describe, expect, it } from 'vitest'
import { BLEND_S, SHOT_S, titleCameraPose, titleShotIndex, type Vec3 } from './titleCamera'

function pose(t: number) {
  const pos: Vec3 = [0, 0, 0]
  const target: Vec3 = [0, 0, 0]
  titleCameraPose(t, pos, target)
  return { pos, target }
}

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

function viewDir(t: number): Vec3 {
  const { pos, target } = pose(t)
  const d: Vec3 = [target[0] - pos[0], target[1] - pos[1], target[2] - pos[2]]
  const len = Math.hypot(...d)
  return [d[0] / len, d[1] / len, d[2] / len]
}

describe('title camera', () => {
  it('alternates two shots every SHOT_S seconds', () => {
    expect(titleShotIndex(0)).toBe(0)
    expect(titleShotIndex(SHOT_S - 0.01)).toBe(0)
    expect(titleShotIndex(SHOT_S + 0.01)).toBe(1)
    // Mid-shot, the orbit and the dolly are far apart.
    expect(dist(pose(SHOT_S * 0.5).pos, pose(SHOT_S * 1.5).pos)).toBeGreaterThan(100)
  })

  it('moves continuously, including across every blend and shot boundary', () => {
    const dt = 1 / 60
    let prev = pose(0)
    // 400 s covers several full orbits, so every orbit angle a blend can start from.
    for (let t = dt; t < 400; t += dt) {
      const cur = pose(t)
      // The longest blend (orbit far side to the dolly, ~350 units over BLEND_S) stays under 2.5 units a frame.
      expect(dist(cur.pos, prev.pos)).toBeLessThan(2.5)
      expect(dist(cur.target, prev.target)).toBeLessThan(2.5)
      prev = cur
    }
  })

  it('shows a different angle 6 s later, wherever the title screenshot lands', () => {
    for (let t = 0; t < SHOT_S * 4; t += 0.5) {
      const a = viewDir(t)
      const b = viewDir(t + 6)
      const deg = (Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) * 180) / Math.PI
      const moved = dist(pose(t).pos, pose(t + 6).pos)
      expect(deg > 8 || moved > 40).toBe(true)
    }
  })

  it('stays above the ground and inside the 600-unit park', () => {
    for (let t = 0; t < SHOT_S * 8; t += 0.25) {
      const { pos } = pose(t)
      expect(pos[1]).toBeGreaterThan(10)
      expect(Math.abs(pos[0])).toBeLessThan(300)
      expect(Math.abs(pos[2])).toBeLessThan(300)
    }
  })

  it('blends with a lift so the move clears the tents', () => {
    const mid = (SHOT_S * 2 - BLEND_S / 2)
    expect(pose(mid).pos[1]).toBeGreaterThan(40)
  })
})
