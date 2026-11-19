import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createSplineCurve } from './curves/SplineCurve'
import { advanceRide, resetRide, rideSpeeds, type RideState } from './ridePhysics'
import { buildArcTable } from './arcLength'
import { type JunctionMechanic, SWITCH_BOARD_H, SWITCH_HIT_RADIUS, buildJunction, checkMechanics, switchOpen, switchPose } from './mechanics'
import { routeCurve, routeSpeedScale } from './mechanics.hot'
import { createSeatPose, seatPose } from './seatPose.hot'
import type { RideMechanic } from '@/types/level'

// A flat oval 1000 × 600 units, ridden anticlockwise seen from above; the branch swings 120 units out of its east side
// and dips 30 under it.
const main = createSplineCurve(
  Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2
    return { x: 500 * Math.cos(a), y: 100, z: -300 * Math.sin(a) }
  }),
)
const at = (t: number) => main.getPointAt(t).clone()
const FROM = 0.15
const TO = 0.3
const outward = (t: number, by: number, dip: number) => {
  const p = at(t)
  const r = Math.hypot(p.x, p.z)
  return { x: p.x + (p.x / r) * by, y: p.y - dip, z: p.z + (p.z / r) * by }
}
const mechanic: JunctionMechanic = { kind: 'junction', from: FROM, to: TO, points: [outward(0.19, 80, 20), outward(0.225, 120, 30), outward(0.26, 80, 20)] }
const mechanics: RideMechanic[] = [mechanic]
const junction = buildJunction(main, mechanic)
const hard = routeCurve(main, mechanics, 'hard')
const SPAN = TO - FROM

/** The car's speed in units per t along a curve, across a small step. */
const speedAt = (curve: { getPointAt(t: number): THREE.Vector3 }, t: number) => {
  const a = curve.getPointAt(t + 1e-5).clone()
  return a.distanceTo(curve.getPointAt(t - 1e-5)) / 2e-5
}

describe('a shoot-to-switch junction (#702)', () => {
  it('forks off the main track and merges back onto it, with no step or kink at either end', () => {
    expect(junction.branch.getPointAt(0).distanceTo(at(FROM))).toBeLessThan(1e-6)
    expect(junction.branch.getPointAt(1).distanceTo(at(TO))).toBeLessThan(1e-6)
    expect(junction.branch.getTangentAt(0).angleTo(main.getTangentAt(FROM))).toBeLessThan(0.05)
    expect(junction.branch.getTangentAt(1).angleTo(main.getTangentAt(TO))).toBeLessThan(0.05)
    expect(junction.branch.getPointAt(0.5).distanceTo(at((FROM + TO) / 2))).toBeGreaterThan(100)
  })

  it('rides the main track on the easy route, and on the hard one the branch only between the fork and the merge', () => {
    expect(routeCurve(main, mechanics, 'easy')).toBe(main)
    expect(routeCurve(main, undefined, 'hard')).toBe(main)
    expect(routeCurve(main, mechanics, 'hard')).toBe(hard)
    for (const t of [0.05, 0.14, 0.31, 0.6, 1.05]) {
      expect(hard.getPointAt(t).distanceTo(main.getPointAt(t))).toBe(0)
    }
    expect(hard.getPointAt(0.22).distanceTo(junction.branch.getPointAt((0.22 - FROM) / SPAN))).toBe(0)
    // A later lap (the ride's t wraps) forks at the same place.
    expect(hard.getPointAt(1.22).distanceTo(junction.branch.getPointAt((0.22 - FROM) / SPAN))).toBeLessThan(1e-6)
  })

  it('scales the ride\'s g-forces by how much faster the seat moves on the branch, and not at all off it', () => {
    expect(routeSpeedScale(main, main, 0.22)).toBe(1)
    expect(routeSpeedScale(main, hard, 0.6)).toBeCloseTo(1, 6)
    expect(routeSpeedScale(main, hard, 0.22)).toBeGreaterThan(1.05)
  })

  it('seats the rider on the branch through seatPose on the hard route, on the main track on the easy one', () => {
    const table = buildArcTable(main)
    const pose = createSeatPose()
    seatPose(main, table, 0.22, 1, 2, pose, mechanics, -1, 'hard')
    expect(pose.eye.distanceTo(junction.branch.getPointAt((0.22 - FROM) / SPAN))).toBeCloseTo(2, 3)
    seatPose(main, table, 0.22, 1, 2, pose, mechanics, -1, 'easy')
    expect(pose.eye.distanceTo(main.getPointAt(0.22))).toBeCloseTo(2, 3)
  })

  it('keeps the car moving forward on the branch, at the main track\'s speed where it forks and merges', () => {
    const n = 400
    let prevArc = -1
    let arc = 0
    let fastest = 0
    const branchPoint = (u: number) => junction.branch.getPointAt(u).clone()
    let prev = branchPoint(0)
    for (let i = 1; i <= n; i++) {
      const p = branchPoint(i / n)
      const step = p.distanceTo(prev)
      arc += step
      expect(arc).toBeGreaterThan(prevArc)
      prevArc = arc
      prev = p
      fastest = Math.max(fastest, (step * n) / SPAN / speedAt(main, FROM + (SPAN * (i - 0.5)) / n))
    }
    for (const t of [FROM, TO]) expect(speedAt(hard, t + 2e-5) / speedAt(main, t + 2e-5)).toBeCloseTo(1, 1)
    // Longer than the easy way, so the hard way is ridden faster: never wildly so.
    expect(fastest).toBeGreaterThan(1.05)
    expect(fastest).toBeLessThan(2)
  })

  it('lands every beat on the same second either way: the car reaches the merge together on both routes', () => {
    const speeds = rideSpeeds({ rollerSpeed: 0.00002, minRollerSpeed: 0.0004 })
    const ride = (route: 'easy' | 'hard') => {
      const seat = routeCurve(main, mechanics, route)
      const state: RideState = { progress: 0, velocity: 0, time: 0 }
      resetRide(state)
      const seen: number[] = []
      for (let frame = 0; frame < 60 * 30 && state.progress < TO + 0.02; frame++) {
        advanceRide(state, main, speeds, 1)
        const p = seat.getPointAt(state.progress)
        if (state.progress >= TO && seen.length === 0) seen.push(state.time, p.x, p.y, p.z)
      }
      return seen
    }
    const easy = ride('easy')
    const harder = ride('hard')
    expect(easy.length).toBe(4)
    expect(harder[0]).toBe(easy[0])
    expect(Math.hypot(harder[1] - easy[1], harder[2] - easy[2], harder[3] - easy[3])).toBeLessThan(1e-6)
  })

  it('stands the switch before the fork on the branch\'s side, open only until the car reaches it', () => {
    const pose = switchPose(main, junction, 6)
    expect(pose.t).toBeLessThan(FROM)
    expect(pose.t).toBeGreaterThan(FROM - SPAN)
    // The branch swings outward: on an anticlockwise oval that is the car's right.
    expect(pose.side).toBe(1)
    const r = (p: THREE.Vector3) => Math.hypot(p.x, p.z)
    expect(r(pose.position)).toBeGreaterThan(r(at(pose.t)))
    expect(pose.position.y).toBeGreaterThan(at(pose.t).y)
    // The board faces the oncoming car: its normal (yaw about world up from +z) against the track's direction.
    const normal = new THREE.Vector3(Math.sin(pose.yaw), 0, Math.cos(pose.yaw))
    expect(normal.dot(main.getTangentAt(pose.t))).toBeLessThan(-0.9)
    expect(switchOpen(0, pose)).toBe(true)
    expect(switchOpen(pose.t - 0.001, pose)).toBe(true)
    expect(switchOpen(pose.t, pose)).toBe(false)
    expect(switchOpen(TO, pose)).toBe(false)
  })

  it('takes a hit on the board only: a point just above or below it misses the switch', () => {
    const eye = 6
    const pose = switchPose(main, junction, eye)
    const hit = (p: THREE.Vector3) => p.distanceToSquared(pose.position) <= (SWITCH_HIT_RADIUS * eye) ** 2
    expect(hit(pose.position)).toBe(true)
    const edge = (SWITCH_BOARD_H / 2 + 0.05) * eye
    expect(hit(pose.position.clone().add(new THREE.Vector3(0, edge, 0)))).toBe(false)
    expect(hit(pose.position.clone().add(new THREE.Vector3(0, -edge, 0)))).toBe(false)
  })

  it('refuses a junction over another mechanic, from its sign to its merge', () => {
    expect(() => checkMechanics(mechanics)).not.toThrow()
    const sign = switchPose(main, junction, 6).t
    const drop: RideMechanic = { kind: 'dropTrack', from: TO - 0.01, to: TO + 0.05, seconds: 1 }
    expect(() => checkMechanics([mechanic, drop])).toThrow(/overlaps the dropTrack/)
    const beforeSign: RideMechanic = { kind: 'backwards', from: sign - 0.05, to: sign + 0.005, seconds: 1, speed: 10 }
    expect(() => checkMechanics([mechanic, beforeSign])).toThrow(/overlaps the backwards/)
    // A jump's booster counts as the jump.
    const jump: RideMechanic = { kind: 'jumpGap', from: TO + 0.05, to: TO + 0.07, speed: 10, boostFrom: TO - 0.01 }
    expect(() => checkMechanics([mechanic, jump])).toThrow(/overlaps the jumpGap/)
    const clear: RideMechanic = { kind: 'dropTrack', from: TO + 0.01, to: TO + 0.05, seconds: 1 }
    expect(() => checkMechanics([mechanic, clear])).not.toThrow()
  })

  it('refuses a junction it cannot ride', () => {
    expect(() => buildJunction(main, { kind: 'junction', from: 0.9, to: 0.1, points: mechanic.points })).toThrow(/from < to/)
    expect(() => buildJunction(main, { kind: 'junction', from: FROM, to: TO, points: [] })).toThrow(/a way round/)
    const flat = { getPointAt: main.getPointAt, getTangentAt: main.getTangentAt }
    expect(() => buildJunction(flat, mechanic)).toThrow(/spline/)
    const rolling = createSplineCurve([
      { x: 0, y: 0, z: 0, up: { x: 0, y: 1, z: 0 } },
      { x: 100, y: 0, z: 0 },
      { x: 100, y: 0, z: 100 },
      { x: 0, y: 0, z: 100 },
    ])
    expect(() => buildJunction(rolling, mechanic)).toThrow(/rolling/)
  })
})
