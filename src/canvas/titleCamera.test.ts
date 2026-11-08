import { describe, expect, it } from 'vitest'
import {
  ATTRACT_SHOT_S,
  BEAT_LOCK_MAX,
  BLEND_S,
  SHOT_S,
  beatLockedRate,
  titleCameraPose,
  titleShotIndex,
  type TitleCameraMode,
  type Vec3,
} from './titleCamera'
import { createTitleRide } from './titleCoaster'

const ride = createTitleRide()

function pose(t: number, mode: TitleCameraMode = 'menu') {
  const pos: Vec3 = [0, 0, 0]
  const target: Vec3 = [0, 0, 0]
  titleCameraPose(t, { ride, rideTime: t }, pos, target, mode)
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
  it('takes turns every SHOT_S seconds', () => {
    expect(titleShotIndex(0)).toBe(0)
    expect(titleShotIndex(SHOT_S - 0.01)).toBe(0)
    expect(titleShotIndex(SHOT_S + 0.01)).toBe(1)
    // Mid-shot, the orbit and the dolly are far apart.
    expect(dist(pose(SHOT_S * 0.5).pos, pose(SHOT_S * 2.5).pos)).toBeGreaterThan(100)
  })

  it.each(['menu', 'attract'] as const)('moves continuously in %s mode, across every blend and shot boundary', (mode) => {
    const dt = 1 / 60
    let prev = pose(0, mode)
    // 400 s covers several full orbits and laps, so every orbit angle and train place a blend can start from.
    for (let t = dt; t < 400; t += dt) {
      const cur = pose(t, mode)
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

  it.each(['menu', 'attract'] as const)('stays above the ground and inside the 600-unit park in %s mode', (mode) => {
    for (let t = 0; t < SHOT_S * 8; t += 0.25) {
      const { pos } = pose(t, mode)
      expect(pos[1]).toBeGreaterThan(10)
      expect(Math.abs(pos[0])).toBeLessThan(300)
      expect(Math.abs(pos[2])).toBeLessThan(300)
    }
  })

  it('blends with a lift so the move clears the tents', () => {
    const mid = (SHOT_S * 2 - BLEND_S / 2)
    expect(pose(mid).pos[1]).toBeGreaterThan(40)
  })

  it('chases the train in its second shot: the cars are ahead, in view', () => {
    for (let t = SHOT_S + 1; t < SHOT_S * 2 - BLEND_S; t += 0.5) {
      const { pos, target } = pose(t)
      const lead: Vec3 = [0, 0, 0]
      ride.pointAt(ride.leadDistance(t), lead)
      const toLead: Vec3 = [lead[0] - pos[0], lead[1] - pos[1], lead[2] - pos[2]]
      const toTarget: Vec3 = [target[0] - pos[0], target[1] - pos[1], target[2] - pos[2]]
      const dot = toLead[0] * toTarget[0] + toLead[1] * toTarget[1] + toLead[2] * toTarget[2]
      expect(dot / (Math.hypot(...toLead) * Math.hypot(...toTarget))).toBeGreaterThan(Math.cos((25 * Math.PI) / 180))
    }
  })

  it('cuts faster in attract mode', () => {
    expect(titleShotIndex(ATTRACT_SHOT_S + 0.01, 'attract')).toBe(1)
    expect(ATTRACT_SHOT_S).toBeLessThan(SHOT_S)
  })
})

describe('beat-locked cuts', () => {
  const grid = { origin: 3, beatS: 60 / 108, beats: 4 }
  const barS = grid.beatS * grid.beats

  it('runs at 1 without music', () => {
    expect(beatLockedRate(5, SHOT_S, null, 10)).toBe(1)
  })

  it('stays within BEAT_LOCK_MAX of real time', () => {
    for (let cam = 0; cam < 30; cam += 0.37) {
      for (let now = 0; now < 10; now += 0.29) {
        const r = beatLockedRate(cam, SHOT_S, grid, now)
        expect(r).toBeGreaterThanOrEqual(1 - BEAT_LOCK_MAX)
        expect(r).toBeLessThanOrEqual(1 + BEAT_LOCK_MAX)
      }
    }
  })

  it('lands every cut after the first on a bar line, wherever the music starts', () => {
    for (const start of [0.3, 2.9, 5.5, 7.7, 11.6]) {
      let cam = start
      let now = 10 + start * 1.3
      const dt = 1 / 60
      // The first cut may come too soon to move onto a bar; a whole shot is long enough.
      const shot = titleShotIndex(cam) + 1
      while (titleShotIndex(cam) <= shot) {
        cam += beatLockedRate(cam, SHOT_S, grid, now) * dt
        now += dt
      }
      const intoBar = (now - grid.origin) % barS
      expect(Math.min(intoBar, barS - intoBar)).toBeLessThan(0.05)
    }
  })
})
