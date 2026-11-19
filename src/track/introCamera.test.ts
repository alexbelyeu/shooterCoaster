import { describe, expect, it } from 'vitest'
import {
  ORBIT_RATE, READY_HOLD, createSwoopClock, createTrackApproach, orbitPose, stepSwoopClock, swoopPose, type HeroShot,
} from './introCamera.hot'
import { getAllLevels } from '@/levels/LevelRegistry'
import { createTrackCurve } from './curves/createTrackCurve'
import { getTrackDimensions } from './trackDimensions'
import { buildArcTable } from './arcLength'
import { BIOMES } from '@/levels/environments/biomeRegistry'
import { HALL_BOUNDS } from '@/levels/environments/biomes/gym/config'

const v = (x = 0, y = 0, z = 0) => ({ x, y, z })
const dist = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
const angleDeg = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => {
  const d = (a.x * b.x + a.y * b.y + a.z * b.z) / (Math.hypot(a.x, a.y, a.z) * Math.hypot(b.x, b.y, b.z))
  return (Math.acos(Math.min(Math.max(d, -1), 1)) * 180) / Math.PI
}

/** Each level's seat (track start + eye height), ride direction, landmark focus point and track approach (`hero.approach`). */
function levelShots() {
  return getAllLevels().map((level) => {
    const curve = createTrackCurve(level.track)
    const dims = getTrackDimensions(level.track)
    const p = curve.getPointAt(0)
    const t = curve.getTangentAt(0)
    const hero = BIOMES[level.biome].hero
    // Flat ground at 0 is enough for the path's shape.
    const anchor = v(hero.x, (hero.ground ?? 0) + hero.focus, hero.z)
    const seat = v(p.x, p.y + dims.eyeHeight, p.z)
    const dir = v(t.x, t.y, t.z)
    const approach = hero.approach
      ? createTrackApproach(curve, buildArcTable(curve), hero.approach * dims.trackScale, dims.eyeHeight, () => 0)
      : undefined
    return { id: level.id, seat, dir, anchor, scale: dims.trackScale, biome: level.biome, approach }
  })
}

describe('swoopPose', () => {
  it('lands exactly on the seat pose at progress 1, on every level', () => {
    for (const s of levelShots()) {
      const pos = v()
      const dir = v()
      const bank = swoopPose(s.seat, s.dir, s.anchor, s.scale, 1, undefined, pos, dir, s.approach)
      expect({ id: s.id, pos, dir, bank }).toEqual({ id: s.id, pos: s.seat, dir: s.dir, bank: 0 })
    }
  })

  it('starts high over the seat, looking at the landmark, and comes in without a jump', () => {
    for (const s of levelShots()) {
      const pos = v()
      const dir = v()
      swoopPose(s.seat, s.dir, s.anchor, s.scale, 0, undefined, pos, dir, s.approach)
      const toAnchor = v(s.anchor.x - pos.x, s.anchor.y - pos.y, s.anchor.z - pos.z)
      const start = { id: s.id, high: pos.y - s.seat.y >= 100 * s.scale, looksAtAnchor: Math.abs(angleDeg(dir, toAnchor) - 12) < 0.01 }

      // Steps of 1/200 of the swoop: no big hop between any two, and the last ones settle into the seat.
      let maxStep = 0
      let maxTurn = 0
      const prev = { ...pos }
      const prevDir = { ...dir }
      for (let i = 1; i <= 200; i++) {
        swoopPose(s.seat, s.dir, s.anchor, s.scale, i / 200, undefined, pos, dir, s.approach)
        maxStep = Math.max(maxStep, dist(pos, prev))
        maxTurn = Math.max(maxTurn, angleDeg(dir, prevDir))
        Object.assign(prev, pos)
        Object.assign(prevDir, dir)
      }
      swoopPose(s.seat, s.dir, s.anchor, s.scale, 0.999, undefined, pos, dir, s.approach)
      const near = { offset: dist(pos, s.seat) < 0.5 * s.scale, angle: angleDeg(dir, s.dir) < 0.5 }
      expect({ ...start, ...near, smooth: maxStep < 12 * s.scale && maxTurn < 5 }).toEqual({
        id: s.id, high: true, looksAtAnchor: true, offset: true, angle: true, smooth: true,
      })
    }
  })

  it('keeps an interior swoop inside its walls', () => {
    const gym = levelShots().find((s) => s.biome === 'gym')!
    const pos = v()
    const dir = v()
    let outside = 0
    for (let i = 0; i <= 100; i++) {
      swoopPose(gym.seat, gym.dir, gym.anchor, gym.scale, i / 100, HALL_BOUNDS, pos, dir, gym.approach)
      if (pos.x < HALL_BOUNDS.minX || pos.x > HALL_BOUNDS.maxX || pos.z < HALL_BOUNDS.minZ || pos.z > HALL_BOUNDS.maxZ || pos.y > HALL_BOUNDS.maxY) outside++
    }
    expect(outside).toBe(0)
  })

  it('banks into the turn and is level at both ends', () => {
    const seat = v(0, 100, 0)
    const ahead = v(1, 0, 0)
    // Landmark off to the left of the ride (-z is left of +x with y up), so the view turns right onto the track.
    const left = swoopPose(seat, ahead, v(300, 0, -300), 1, 0.5, undefined, v(), v())
    const right = swoopPose(seat, ahead, v(300, 0, 300), 1, 0.5, undefined, v(), v())
    expect(Math.sign(left)).toBe(-Math.sign(right))
    expect(swoopPose(seat, ahead, v(300, 0, 300), 1, 0, undefined, v(), v())).toBeCloseTo(0, 12)
  })
})

describe('stepSwoopClock', () => {
  it('waits for the level to show, eases short of the seat through Ready, then lands at GO with zero speed', () => {
    const c = createSwoopClock()
    expect(stepSwoopClock(c, 0.1, false, null)).toBe(0)
    let p = 0
    for (let i = 0; i < 300; i++) p = stepSwoopClock(c, 1 / 60, true, null)
    expect(p).toBeLessThan(READY_HOLD)
    expect(p).toBeGreaterThan(READY_HOLD * 0.9)

    const set = 0.85
    const samples: number[] = []
    for (let toGo = set; toGo > 0; toGo -= 1 / 60) samples.push(stepSwoopClock(c, 1 / 60, true, toGo))
    samples.push(stepSwoopClock(c, 1 / 60, true, 0))
    expect(samples.every((x, i) => i === 0 || x >= samples[i - 1] - 1e-12)).toBe(true)
    expect(samples[samples.length - 1]).toBe(1)
    expect(1 - samples[samples.length - 2]).toBeLessThan(0.01)
    // GO held back (a smoke hold): the seat holds.
    expect(stepSwoopClock(c, 1 / 60, true, -0.5)).toBe(1)
  })

  it('lands a swoop that only starts at Set', () => {
    const c = createSwoopClock()
    let p = 0
    for (let toGo = 0.85; toGo > 0; toGo -= 0.1) p = stepSwoopClock(c, 0.1, true, toGo)
    expect(p).toBeGreaterThan(0.9)
    expect(stepSwoopClock(c, 0.1, true, 0)).toBe(1)
  })

  it('goes straight to the seat when GO is already due', () => {
    expect(stepSwoopClock(createSwoopClock(), 0.016, true, 0)).toBe(1)
  })
})

describe('orbitPose', () => {
  const flat = () => 0
  const hero: HeroShot = { x: 100, z: -50, focus: 80, orbitRadius: 400, orbitHeight: 200 }

  it('circles the landmark at its radius and height, a turn a minute, looking at its focus', () => {
    const pos = v()
    const target = v()
    orbitPose(hero, 10, 0, 0, flat, undefined, pos, target)
    expect(pos).toEqual(v(500, 210, -50))
    expect(target).toEqual(v(100, 90, -50))
    orbitPose(hero, 10, Math.PI / 2 / ORBIT_RATE, 0, flat, undefined, pos, target)
    expect(pos.x).toBeCloseTo(100, 6)
    expect(pos.z).toBeCloseTo(350, 6)
  })

  it('rises over ground higher than the landmark\'s', () => {
    const pos = v()
    orbitPose(hero, 0, 0, 0, () => 500, undefined, pos, v())
    expect(pos.y).toBeGreaterThan(500)
  })

  it('swings a wall landmark through its arc, inside the hall', () => {
    const gym = BIOMES.gym.hero
    const pos = v()
    const target = v()
    let maxYaw = 0
    let outside = 0
    for (let s = 0; s < 120; s += 0.5) {
      orbitPose(gym, 0, s, 0, flat, HALL_BOUNDS, pos, target)
      maxYaw = Math.max(maxYaw, Math.abs(Math.atan2(pos.z - gym.z, pos.x - gym.x) - gym.facing!))
      if (pos.x < HALL_BOUNDS.minX || pos.x > HALL_BOUNDS.maxX || pos.z < HALL_BOUNDS.minZ || pos.z > HALL_BOUNDS.maxZ || pos.y > HALL_BOUNDS.maxY) outside++
    }
    expect(outside).toBe(0)
    expect(maxYaw).toBeLessThanOrEqual(gym.arc! + 1e-9)
  })
})
