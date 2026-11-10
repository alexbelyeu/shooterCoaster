import { describe, expect, it } from 'vitest'
import type { WallSurface } from '@/types/level'
import { WALL_STANDOFF, wallNormal, wallPoint } from '@/entities/spawning/enemyPlacement'
import { CLIMB, METRE, climbPose, climbRoute, newClimbPose } from './climbMotion'

const wall: WallSurface = {
  id: 'w',
  origin: { x: 100, y: 20, z: -50 },
  right: { x: 0, y: 0, z: -1 },
  up: { x: 0, y: 1, z: 0 },
  width: 240,
  height: 600,
}
const route = climbRoute({ u: 120, v: 10 }, wall, 7)
const MOVE = CLIMB.reach + CLIMB.pull + CLIMB.rest

describe('climbRoute', () => {
  it('climbs from its start to just under the top, a step at a time', () => {
    expect(route.v[0]).toBe(10)
    expect(route.v[route.v.length - 1]).toBe(wall.height - CLIMB.topOut)
    for (let k = 1; k < route.v.length; k++) {
      const rise = route.v[k] - route.v[k - 1]
      expect(rise).toBeGreaterThan(0)
      expect(rise).toBeLessThanOrEqual(CLIMB.step * 1.15 + 1e-9)
    }
  })

  it('is the same route for the same seed, another for another', () => {
    expect(climbRoute({ u: 120, v: 10 }, wall, 7)).toEqual(route)
    expect(climbRoute({ u: 120, v: 10 }, wall, 8).u).not.toEqual(route.u)
  })

  it('stops to clip every few moves', () => {
    const moves = route.moveStart.length
    const clips = Math.floor((moves - 1) / CLIMB.clipEvery)
    expect(clips).toBeGreaterThan(0)
    expect(route.duration).toBeCloseTo(moves * MOVE + clips * CLIMB.clip)
  })

  it('climbs at about a metre a second, clips included', () => {
    const speed = (route.v[route.v.length - 1] - route.v[0]) / route.duration
    expect(speed).toBeGreaterThan(0.75 * METRE)
    expect(speed).toBeLessThan(1.25 * METRE)
  })
})

describe('climbPose', () => {
  const pose = newClimbPose()

  it('stays on the wall plane, inside the wall', () => {
    const n = wallNormal(wall)
    const p = { x: 0, y: 0, z: 0 }
    for (let t = 0; t <= route.duration; t += 0.05) {
      climbPose(route, t, pose)
      expect(pose.u).toBeGreaterThanOrEqual(CLIMB.margin - 1e-9)
      expect(pose.u).toBeLessThanOrEqual(wall.width - CLIMB.margin + 1e-9)
      expect(pose.v).toBeGreaterThanOrEqual(0)
      expect(pose.v).toBeLessThanOrEqual(wall.height)
      wallPoint(wall, pose.u, pose.v, WALL_STANDOFF, p, n)
      const off = (p.x - wall.origin.x) * n.x + (p.y - wall.origin.y) * n.y + (p.z - wall.origin.z) * n.z
      expect(off).toBeCloseTo(WALL_STANDOFF)
    }
  })

  it('alternates the lead arm move by move, the other leg stepping up as it pulls', () => {
    for (let k = 0; k < 6; k++) {
      climbPose(route, route.moveStart[k] + CLIMB.reach, pose)
      expect(pose.lead).toBe(k % 2)
      expect(pose.arms[pose.lead]).toBeCloseTo(1)
      expect(pose.arms[1 - pose.lead]).toBeLessThan(0.5)
      const before = pose.legs
      climbPose(route, route.moveStart[k] + CLIMB.reach + CLIMB.pull, pose)
      expect(Math.sign(pose.legs)).toBe(-Math.sign(before))
    }
  })

  it('reaches, pulls up to the next hold, rests, and clips after every few moves', () => {
    expect(climbPose(route, route.moveStart[2] + CLIMB.reach / 2, pose).phase).toBe('reach')
    expect(pose.v).toBe(route.v[2])
    expect(climbPose(route, route.moveStart[2] + CLIMB.reach + CLIMB.pull / 2, pose).phase).toBe('pull')
    expect(pose.v).toBeGreaterThan(route.v[2])
    expect(pose.v).toBeLessThan(route.v[3])
    expect(climbPose(route, route.moveStart[2] + MOVE - 0.01, pose).phase).toBe('rest')
    expect(pose.v).toBe(route.v[3])
    const clipAt = route.moveStart[CLIMB.clipEvery - 1] + MOVE + CLIMB.clip / 2
    expect(climbPose(route, clipAt, pose).phase).toBe('clip')
    expect(pose.arms[1 - pose.lead]).toBeGreaterThan(0.5)
  })

  it('moves its limbs smoothly, never in a jump', () => {
    const a = newClimbPose()
    const b = newClimbPose()
    for (let t = 0; t < route.duration - 0.01; t += 0.01) {
      climbPose(route, t, a)
      climbPose(route, t + 0.002, b)
      expect(Math.abs(a.arms[0] - b.arms[0])).toBeLessThan(0.05)
      expect(Math.abs(a.arms[1] - b.arms[1])).toBeLessThan(0.05)
      expect(Math.abs(a.legs - b.legs)).toBeLessThan(0.1)
      expect(Math.abs(a.v - b.v)).toBeLessThan(1)
    }
  })

  it('escapes at the top, not before', () => {
    expect(climbPose(route, route.duration - 0.01, pose).escaped).toBe(false)
    expect(pose.v).toBeCloseTo(route.v[route.v.length - 1])
    expect(climbPose(route, route.duration, pose).escaped).toBe(true)
    expect(pose.phase).toBe('topped')
  })

  it('escapes at once when it starts at the top', () => {
    const top = climbRoute({ u: 50, v: wall.height }, wall, 1)
    expect(top.duration).toBe(0)
    expect(climbPose(top, 0, pose).escaped).toBe(true)
  })
})
