import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { RideMechanic, TrackParams } from '@/types/level'
import { buildArcTable } from './arcLength'
import { buildMechanicsRide, MECHANICS_SPEEDS } from './elements/mechanicsRide'
import { DEMO_EYE } from './elements/demoRide'
import { buildTrackGeometry } from './trackGeometry'
import { getTrackDimensions } from './trackDimensions'
import { dropPieceLength, trackGaps, withMechanics } from './mechanics'
import { backwardsTurn, dropPiecePosition } from './mechanics.hot'
import { buildMechanicsGeometry } from './mechanicsGeometry'
import { BEAT_TOLERANCE_SECONDS, buildRidePlan, planDistance, planSpeed, planStopShare, planTimeAt, RIDE_V2_DEFAULTS, type RidePlan } from './rideV2'
import { rideModel, rideProfile, riddenBetween } from './ridePhysics'
import { createSeatPose, seatPose } from './seatPose.hot'

const ride = buildMechanicsRide()
const table = buildArcTable(ride.curve)
const length = table.length
const dims = getTrackDimensions({ scalar: 20 })
const spec = withMechanics(ride.spec, ride.mechanics, length)
const plan = buildRidePlan(table, spec)
const g = RIDE_V2_DEFAULTS.gravity

function mechanic<K extends RideMechanic['kind']>(kind: K): Extract<RideMechanic, { kind: K }> {
  return ride.mechanics.find((m) => m.kind === kind) as Extract<RideMechanic, { kind: K }>
}

/** Seconds after GO the plan first reaches share `at` of the lap. */
const timeAt = (p: RidePlan, at: number) => planTimeAt(p, at * length)
const speedAt = (p: RidePlan, at: number) => planSpeed(p, timeAt(p, at))

describe('station + launch (#699)', () => {
  const station = mechanic('station')

  it('starts standing at the station and launches on GO to its speed by the fins’ end, ~2 s', () => {
    expect(station.from).toBe(0)
    expect(planDistance(plan, 0)).toBe(0)
    expect(planSpeed(plan, 0)).toBe(0)
    expect(speedAt(plan, station.to)).toBeGreaterThan(MECHANICS_SPEEDS.launch * 0.9)
    expect(timeAt(plan, station.to)).toBeGreaterThan(1.5)
    expect(timeAt(plan, station.to)).toBeLessThan(3)
  })

  it('builds the station and its fins', () => {
    const geometry = buildMechanicsGeometry(ride.curve, table, [station], dims)
    expect(geometry?.attributes.position.count).toBeGreaterThan(0)
    geometry?.dispose()
  })

  it('must be at the ride’s start, on a v2 ride', () => {
    expect(() => withMechanics({}, [{ ...station, from: 0.1, to: 0.2 }], length)).toThrow(/at 0/)
    const track: TrackParams = {
      curve: 'spline', varA: 0, varB: 0, varC: 0, scalar: 20, rollerSpeed: 0, minRollerSpeed: 0, color1: 0, color2: 0, mechanics: [station],
    }
    expect(() => rideModel(track, table)).toThrow(/v2/)
  })
})

describe('jump gap (#699)', () => {
  const gap = mechanic('jumpGap')
  const lip = ride.curve.getPointAt(gap.from).clone()
  const heading = ride.curve.getTangentAt(gap.from).clone().setY(0).normalize()
  // `jumpGap`'s default take-off angle.
  const angle = Math.PI / 7

  it('reaches the lip at the speed its arc was built for', () => {
    expect(Math.abs(speedAt(plan, gap.from) / MECHANICS_SPEEDS.jump - 1)).toBeLessThan(0.03)
  })

  it('flies a ballistic arc at that speed, in its time, to the landing at the lip’s height', () => {
    const v = MECHANICS_SPEEDS.jump
    const level = v * Math.cos(angle)
    let worst = 0
    for (let i = 0; i <= 40; i++) {
      const p = ride.curve.getPointAt(gap.from + ((gap.to - gap.from) * i) / 40)
      const x = p.clone().sub(lip).dot(heading)
      const ballistic = x * Math.tan(angle) - (g * x * x) / (2 * level * level)
      worst = Math.max(worst, Math.abs(p.y - lip.y - ballistic))
    }
    expect(worst).toBeLessThan(0.5)
    const landing = ride.curve.getPointAt(gap.to).clone().sub(lip)
    expect(Math.abs(landing.y)).toBeLessThan(0.5)
    expect(Math.abs(landing.dot(heading) / ((v * v * Math.sin(2 * angle)) / g) - 1)).toBeLessThan(0.02)
    const flight = timeAt(plan, gap.to) - timeAt(plan, gap.from)
    expect(Math.abs(flight / ((2 * v * Math.sin(angle)) / g) - 1)).toBeLessThan(0.05)
  })

  it('leaves the gap open: no rails, spine or ties', () => {
    const gaps = trackGaps([gap], length, dropPieceLength(DEMO_EYE))
    const geometry = buildTrackGeometry(ride.curve, table, dims, 2000, [1, 0, 0], [1, 1, 0], gaps)
    const pos = geometry.attributes.position
    const index = geometry.index!
    const apex = ride.curve.getPointAt((gap.from + gap.to) / 2)
    const near = new THREE.Vector3()
    let closest = Infinity
    for (let i = 0; i < index.count; i++) closest = Math.min(closest, near.fromBufferAttribute(pos, index.getX(i)).distanceTo(apex))
    geometry.dispose()
    const halfGap = ((gap.to - gap.from) * length) / 2
    expect(closest).toBeGreaterThan(halfGap * 0.8)
  })
})

describe('drop track (#699)', () => {
  const drop = mechanic('dropTrack')
  const top = ride.curve.getPointAt(drop.from).clone()
  const bottom = ride.curve.getPointAt(drop.to).clone()

  it('brakes late to a stop at the top, holds its seconds, then free-falls straight down', () => {
    const stop = plan.stops.find((s) => Math.abs(s.distance - drop.from * length) < 1e-6)!
    expect(stop.end - stop.start).toBeCloseTo(drop.seconds, 1)
    expect(planStopShare(plan, (stop.start + stop.end) / 2)).toBeCloseTo(0.5, 1)
    const crawl = RIDE_V2_DEFAULTS.crawl
    expect(planSpeed(plan, stop.start - 1 / 60)).toBeLessThan(crawl * 1.5)
    expect(planSpeed(plan, stop.start - 0.5)).toBeGreaterThan(crawl * 3)
    const height = top.y - bottom.y
    expect(height).toBeGreaterThan(35)
    const fall = Math.sqrt(2 * g * height)
    const fastest = Math.max(...Array.from({ length: 40 }, (_, i) => speedAt(plan, drop.from + ((drop.to - drop.from) * (i + 1)) / 41)))
    expect(fastest / fall).toBeGreaterThan(0.85)
    expect(fastest / fall).toBeLessThan(1.1)
  })

  it('keeps the seat upright facing the drop’s heading, the piece under it', () => {
    const pose = createSeatPose()
    const heading = ride.curve.getTangentAt(drop.from).clone().setY(0).normalize()
    const piece = new THREE.Vector3()
    const pieceShare = dropPieceLength(DEMO_EYE) / 2 / length
    for (let i = 0; i <= 10; i++) {
      const t = drop.from + ((drop.to - drop.from) * i) / 10
      seatPose(ride.curve, table, t, dims.trackScale, DEMO_EYE, pose, ride.mechanics)
      expect(pose.up.y).toBe(1)
      expect(pose.look.dot(heading)).toBeGreaterThan(0.999)
      dropPiecePosition(ride.curve, drop, t, pieceShare, piece)
      expect(piece.distanceTo(pose.eye)).toBeCloseTo(DEMO_EYE, 5)
    }
    expect(dropPiecePosition(ride.curve, drop, drop.from - 0.01, pieceShare, piece).distanceTo(top)).toBeLessThan(1e-6)
    expect(dropPiecePosition(ride.curve, drop, drop.to + pieceShare / 2, pieceShare, piece).distanceTo(bottom)).toBeLessThan(1e-6)
  })

  it('opens the rails down the shaft and builds its guides', () => {
    const [[from, to]] = trackGaps([drop], length, dropPieceLength(DEMO_EYE))
    expect(from).toBeLessThan(drop.from * length)
    expect(to).toBeGreaterThan(drop.to * length)
    const geometry = buildMechanicsGeometry(ride.curve, table, [drop], dims)
    expect(geometry?.attributes.position.count).toBeGreaterThan(0)
    geometry?.dispose()
  })
})

describe('backwards (#699)', () => {
  const back = mechanic('backwards')
  const stops = plan.stops.filter((s) => s.distance < length && [back.from, back.to].some((at) => Math.abs((s.distance % length) - at * length) < 1e-6))

  it('stops on each turntable for its seconds and launches out of the first', () => {
    expect(stops).toHaveLength(2)
    for (const stop of stops) expect(stop.end - stop.start).toBeCloseTo(back.seconds, 1)
    expect(Math.max(...Array.from({ length: 20 }, (_, i) => speedAt(plan, back.from + ((back.to - back.from) * i) / 20)))).toBeGreaterThan(MECHANICS_SPEEDS.backwards * 0.9)
  })

  it('turns the seat round on the first turntable, rides facing back, turns forward on the second', () => {
    const mid = (back.from + back.to) / 2
    expect(backwardsTurn(ride.mechanics, back.from - 0.001, -1)).toBe(0)
    expect(backwardsTurn(ride.mechanics, back.from, 0.5)).toBe(0.5)
    expect(backwardsTurn(ride.mechanics, mid, -1)).toBe(1)
    expect(backwardsTurn(ride.mechanics, back.to, 0.25)).toBe(0.75)
    expect(backwardsTurn(ride.mechanics, back.to + 0.001, -1)).toBe(0)

    const pose = createSeatPose()
    seatPose(ride.curve, table, mid, dims.trackScale, DEMO_EYE, pose, ride.mechanics, -1)
    expect(pose.look.dot(pose.tangent)).toBeLessThan(-0.95)
    expect(pose.up.y).toBeGreaterThan(0.99)
    seatPose(ride.curve, table, back.to + 0.01, dims.trackScale, DEMO_EYE, pose, ride.mechanics, -1)
    expect(pose.look.dot(pose.tangent)).toBeGreaterThan(0.95)
  })

  it('the live seat turns with the plan’s own stops', () => {
    const [first] = stops
    const t = timeAt(plan, back.from)
    expect(Math.abs(t - first.start)).toBeLessThan(0.05)
    expect(backwardsTurn(ride.mechanics, back.from, planStopShare(plan, (first.start + first.end) / 2))).toBeCloseTo(0.5, 1)
  })
})

describe('the mechanics on the solved ride (#699)', () => {
  it('lands storyboard beats around its stops within the solver’s tolerance, the stops unwarped', () => {
    const drop = mechanic('dropTrack')
    const back = mechanic('backwards')
    const beats = [
      { at: drop.to, second: timeAt(plan, drop.to) * 1.15 },
      { at: (back.from + back.to) / 2, second: timeAt(plan, (back.from + back.to) / 2) * 1.1 },
      { at: 0.97, second: timeAt(plan, 0.97) * 0.95 },
    ]
    const solved = buildRidePlan(table, { ...spec, beats })
    beats.forEach((beat, i) => expect(Math.abs(solved.landed[i] - beat.second)).toBeLessThan(BEAT_TOLERANCE_SECONDS))
    expect(solved.scales.some((a) => Math.abs(a - 1) > 0.05)).toBe(true)
    for (const stop of solved.stops.slice(0, 3)) expect(stop.end - stop.start).toBeCloseTo(1.5, 1)
  })

  it('spawning’s ride profile holds still through a stop', () => {
    const profile = rideProfile(table, { roll: 0, min: 0, max: 0, plan }, 60)
    const [stop] = plan.stops
    const from = Math.ceil(stop.start * 10 + 1) / 10
    const to = Math.floor(stop.end * 10 - 1) / 10
    expect(to).toBeGreaterThan(from)
    expect(riddenBetween(profile, from, to)).toBeCloseTo(0, 6)
  })
})
