import { describe, expect, it } from 'vitest'
import type { RideV2Spec, TrackParams } from '@/types/level'
import { getAllLevels } from '@/levels/LevelRegistry'
import { buildArcTable, distanceAtT, tAtDistance } from './arcLength'
import { createTrackCurve } from './curves/createTrackCurve'
import { advanceRide, jumpRide, lapSeconds, rideModel, rideProfile, rideSpeedNorm, type RideState } from './ridePhysics'
import { BEAT_TOLERANCE_SECONDS, buildRidePlan, planDistance, planSpeed, planTimeAt, type RidePlan } from './rideV2'

const RADIUS = 400
const CREST = 150
const deg = (d: number) => (d * Math.PI) / 180

/** Height round a circle: a flat station, a lift hill up to the crest from 60° to 150°, the drop to 210°, flat back round. */
function heightAt(d: number): number {
  if (d <= 60) return 0
  if (d <= 150) return (CREST * (d - 60)) / 90
  if (d <= 165) return CREST
  if (d <= 210) return CREST * (0.5 + 0.5 * Math.cos(Math.PI * ((d - 165) / 45)))
  return 0
}

const TRACK: TrackParams = {
  curve: 'spline',
  controlPoints: Array.from({ length: 48 }, (_, i) => {
    const d = i * 7.5
    return { x: RADIUS * Math.cos(deg(d)), y: heightAt(d), z: RADIUS * Math.sin(deg(d)) }
  }),
  varA: 0,
  varB: 0,
  varC: 0,
  scalar: 20,
  rollerSpeed: 0.000004,
  minRollerSpeed: 0.0001,
  color1: 0,
  color2: 0,
}
const curve = createTrackCurve(TRACK)
const table = buildArcTable(curve)

/** Share of the lap's arc length at the track point nearest `angle` degrees round the circle. */
function shareAt(angle: number): number {
  const x = RADIUS * Math.cos(deg(angle))
  const z = RADIUS * Math.sin(deg(angle))
  let best = 0
  for (let i = 1; i < table.count; i++) {
    if (Math.hypot(table.x[i] - x, table.z[i] - z) < Math.hypot(table.x[best] - x, table.z[best] - z)) best = i
  }
  return table.s[best] / table.length
}

const LAUNCH_SPEED = 120
const CHAIN_SPEED = 20
const BRAKE_SPEED = 30
const ZONES: RideV2Spec['zones'] = [
  { kind: 'launch', from: 0, to: shareAt(55), speed: LAUNCH_SPEED },
  { kind: 'lift', from: shareAt(65), to: shareAt(148), speed: CHAIN_SPEED },
  { kind: 'brake', from: shareAt(320), to: shareAt(350), speed: BRAKE_SPEED },
]

/** Speed the first time the car passes `angle` degrees round. */
const speedAt = (plan: RidePlan, angle: number) => planSpeed(plan, planTimeAt(plan, shareAt(angle) * table.length))

describe('the v2 ride on a launch, a lift hill and a drop', () => {
  const plan = buildRidePlan(table, { zones: ZONES })

  it('launches from a standing start to its speed in about 2 s', () => {
    expect(planSpeed(plan, 0)).toBe(0)
    const reached = Array.from(plan.speed).findIndex((v) => v >= LAUNCH_SPEED) / 60
    expect(reached).toBeGreaterThan(1.5)
    expect(reached).toBeLessThan(2.5)
  })

  it('climbs the lift hill on the chain, crawls over the crest and is fastest at the bottom of the drop', () => {
    expect(speedAt(plan, 110)).toBeCloseTo(CHAIN_SPEED, 0)
    const crest = speedAt(plan, 157)
    const bottom = speedAt(plan, 212)
    expect(crest).toBeLessThan(CHAIN_SPEED * 1.5)
    expect(bottom).toBeGreaterThan(crest * 5)
    expect(bottom).toBeCloseTo(plan.maxSpeed, -1)
  })

  it('the brake slows the car to its speed', () => {
    expect(speedAt(plan, 300)).toBeGreaterThan(BRAKE_SPEED * 2)
    const braked = speedAt(plan, 340)
    expect(braked).toBeLessThanOrEqual(BRAKE_SPEED)
    expect(braked).toBeGreaterThan(BRAKE_SPEED * 0.9)
  })

  it('reads back by distance: planTimeAt inverts planDistance', () => {
    for (const time of [0.5, 7.25, 31, 300]) expect(planTimeAt(plan, planDistance(plan, time))).toBeCloseTo(time, 6)
  })
})

describe('the beat solver', () => {
  it.each([
    ['slower than it rolls', [{ at: 0.3, second: 20 }, { at: 0.75, second: 45 }]],
    ['faster than it rolls', [{ at: 0.4, second: 3 }, { at: 0.6, second: 5 }]],
    ['fast and then slow, against the speed it carries in', [{ at: 0.4, second: 3 }, { at: 0.9, second: 60 }]],
    ['into the second lap', [{ at: 0.5, second: 12 }, { at: 1.4, second: 40 }]],
  ])('lands every beat on its second, %s', (_name, beats) => {
    const plan = buildRidePlan(table, { zones: ZONES, beats })
    beats.forEach((beat, i) => {
      expect(Math.abs(plan.landed[i] - beat.second)).toBeLessThanOrEqual(BEAT_TOLERANCE_SECONDS)
      expect(Math.abs(planTimeAt(plan, beat.at * table.length) - beat.second)).toBeLessThanOrEqual(BEAT_TOLERANCE_SECONDS)
    })
  })

  it('keeps the ride its shape: still slow at the crest, fast at the bottom', () => {
    const plan = buildRidePlan(table, { zones: ZONES, beats: [{ at: shareAt(230), second: 30 }] })
    expect(plan.scales[0]).not.toBeCloseTo(1, 1)
    expect(speedAt(plan, 212)).toBeGreaterThan(speedAt(plan, 157) * 5)
  })

  it('refuses beats out of order', () => {
    expect(() => buildRidePlan(table, { beats: [{ at: 0.5, second: 20 }, { at: 0.4, second: 30 }] })).toThrow()
    expect(() => buildRidePlan(table, { beats: [{ at: 0.4, second: 20 }, { at: 0.5, second: 20 }] })).toThrow()
  })
})

describe('ridePhysics on a v2 ride', () => {
  const speeds = rideModel({ ...TRACK, ride: 'v2', rideV2: { zones: ZONES, beats: [{ at: 0.5, second: 15 }] } }, table)
  const plan = speeds.plan!

  it('only a level that opts in gets a plan', () => {
    expect(rideModel(TRACK, table).plan).toBeUndefined()
  })

  it('rides the plan at any frame rate, so the beats land where spawning predicts them', () => {
    const profile = rideProfile(table, speeds, 20)
    for (const frames of [1, 2.4]) {
      const state: RideState = { progress: 0, velocity: 0, time: 0 }
      while (state.time < 15 - 1e-9) advanceRide(state, curve, speeds, frames)
      expect(distanceAtT(table, state.progress) / table.length).toBeCloseTo(0.5, 1)
      expect(Math.abs(distanceAtT(table, state.progress) - profile[150])).toBeLessThan(frames * 3)
    }
    expect(lapSeconds(curve, speeds)).toBeCloseTo(planTimeAt(plan, table.length))
  })

  it('jumps by track fraction and reports its speed between the slowest and fastest', () => {
    const state: RideState = { progress: 0, velocity: 0, time: 0 }
    jumpRide(state, speeds, tAtDistance(table, 0.5 * table.length))
    expect(state.time).toBeCloseTo(15, 0)
    let fastest = 0
    for (let k = 0; k < 60 * 30; k++) {
      advanceRide(state, curve, speeds, 1)
      fastest = Math.max(fastest, rideSpeedNorm(state, speeds))
      expect(rideSpeedNorm(state, speeds)).toBeGreaterThanOrEqual(0)
    }
    expect(fastest).toBeGreaterThan(0.9)
  })
})

it('every level on the v2 ride lands its storyboard\'s beats', () => {
  for (const level of getAllLevels().filter((l) => l.track.ride === 'v2')) {
    const plan = buildRidePlan(buildArcTable(createTrackCurve(level.track)), level.track.rideV2 ?? {})
    const misses = (level.track.rideV2?.beats ?? []).filter((beat, i) => !(Math.abs(plan.landed[i] - beat.second) <= BEAT_TOLERANCE_SECONDS))
    expect(misses, level.id).toEqual([])
  }
})
