import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { PATH_HALF_WIDTH } from '@/levels/environments/biomes/themePark/parkSpec'
import { titleCameraPose, type Vec3 } from './titleCamera'
import { CROSSING_LOOP, MAIN_LOOP, createTitleRide } from './titleCoaster'
import {
  DROP_TOWER,
  DROP_TOWER_HEIGHT,
  PEOPLE,
  SWING_RIDE,
  TENT_RING,
  buildTitlePark,
  distanceToPath,
  distanceToTrack,
  dropCarHeight,
  flumePoint,
  onRide,
} from './titlePark'

const park = buildTitlePark()

function sample(loop: typeof MAIN_LOOP, n: number) {
  return Array.from({ length: n }, (_, i) => loop.point(i / n, new THREE.Vector3()))
}

describe('title park layout', () => {
  it('is the same park every load', () => {
    expect(buildTitlePark()).toEqual(park)
  })

  it('keeps every stall off the paths, the rides and both coasters', () => {
    expect(park.stalls.length).toBeGreaterThan(60)
    for (const s of park.stalls) {
      expect(distanceToPath(s.x, s.z)).toBeGreaterThan(PATH_HALF_WIDTH)
      expect(onRide(s.x, s.z, 0)).toBe(false)
      expect(distanceToTrack(s.x, s.z)).toBeGreaterThan(10)
    }
  })

  it('stands its crowds on the paths, never on a ride', () => {
    expect(park.people.length).toBe(PEOPLE)
    for (const p of park.people) {
      expect(distanceToPath(p.x, p.z)).toBeLessThanOrEqual(PATH_HALF_WIDTH)
      expect(onRide(p.x, p.z, 0)).toBe(false)
    }
  })

  it('plants trees in clumps off the paths and out of the cameras\' band', () => {
    expect(park.trees.length).toBeGreaterThan(150)
    for (const t of park.trees) {
      expect(distanceToPath(t.x, t.z)).toBeGreaterThan(PATH_HALF_WIDTH)
      expect(Math.hypot(t.x, t.z)).toBeGreaterThan(220)
      expect(distanceToTrack(t.x, t.z)).toBeGreaterThan(8)
    }
  })

  it('hangs a bulb wire across the path between each pair of poles', () => {
    expect(park.lightWires.length).toBeGreaterThan(40)
    expect(park.bulbs.length % 3).toBe(0)
    expect(park.flags.length).toBeGreaterThan(100)
  })
})

describe('second coaster', () => {
  const main = sample(MAIN_LOOP, 1500)
  const crossing = sample(CROSSING_LOOP, 1200)

  it('crosses the hero loop, ducking under its hill with a car and a spine to spare', () => {
    let crossings = 0
    for (const c of crossing) {
      for (const m of main) {
        if (Math.hypot(c.x - m.x, c.z - m.z) > 8) continue
        crossings++
        expect(m.y - c.y).toBeGreaterThan(14)
      }
    }
    expect(crossings).toBeGreaterThan(0)
  })

  it('clears the ground, the tents and the orbit camera (r 180, y 52 and up)', () => {
    for (const c of crossing) {
      expect(c.y).toBeGreaterThan(7)
      const r = Math.hypot(c.x, c.z)
      if (Math.abs(r - 180) < 10) expect(c.y).toBeLessThan(40)
      for (let k = 0; k < TENT_RING.count; k++) {
        const a = (k / TENT_RING.count) * Math.PI * 2
        expect(Math.hypot(c.x - Math.cos(a) * TENT_RING.r, c.z - Math.sin(a) * TENT_RING.r)).toBeGreaterThan(TENT_RING.radius + 6)
      }
      expect(onRide(c.x, c.z, 0) && Math.hypot(c.x, c.z) > TENT_RING.r + TENT_RING.radius).toBe(false)
    }
  })
})

describe('title rides', () => {
  it('drops the tower car onto the cycle line and climbs it smoothly', () => {
    expect(dropCarHeight(0)).toBeLessThan(10)
    expect(dropCarHeight(0.999)).toBeLessThan(12)
    expect(dropCarHeight(0.7)).toBeGreaterThan(80)
    expect(dropCarHeight(0.7)).toBeLessThan(DROP_TOWER_HEIGHT)
    for (let p = 0; p < 0.9; p += 0.01) expect(dropCarHeight(p + 0.01)).toBeGreaterThanOrEqual(dropCarHeight(p) - 1e-9)
  })

  it('stand clear of every camera shot: the drop tower mast, the swing ride and the second coaster', () => {
    const ride = createTitleRide()
    const crossing = sample(CROSSING_LOOP, 300)
    const pos: Vec3 = [0, 0, 0]
    const target: Vec3 = [0, 0, 0]
    for (const mode of ['menu', 'attract'] as const) {
      for (let t = 0; t < 80; t += 0.05) {
        titleCameraPose(t, { ride, rideTime: t }, pos, target, mode)
        expect(Math.hypot(pos[0] - DROP_TOWER.x, pos[2] - DROP_TOWER.z)).toBeGreaterThan(20)
        if (pos[1] < 40) expect(Math.hypot(pos[0] - SWING_RIDE.x, pos[2] - SWING_RIDE.z)).toBeGreaterThan(40)
        for (const c of crossing) expect(Math.hypot(pos[0] - c.x, pos[1] - c.y, pos[2] - c.z)).toBeGreaterThan(12)
      }
    }
  })

  it('runs the flume round a closed loop above the lake', () => {
    const a = flumePoint(0, new THREE.Vector3())
    const b = flumePoint(1, new THREE.Vector3())
    expect(a.distanceTo(b)).toBeLessThan(1e-6)
    const p = new THREE.Vector3()
    let top = 0
    for (let t = 0; t < 1; t += 0.002) top = Math.max(top, flumePoint(t, p).y)
    expect(top).toBeGreaterThan(15)
    expect(distanceToTrack(p.x, p.z)).toBeGreaterThan(20)
  })
})
