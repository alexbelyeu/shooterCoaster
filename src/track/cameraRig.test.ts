import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  BANK_RESPONSE, CURVATURE_SAMPLE_UNITS, DIP_DEG, FLOAT_DRIFT_DEG, FLOAT_PITCH_DEG, HIGH_G_BANK_DEG, LATERAL_ACCEL_REF,
  LAUNCH_PITCH_DEG, LOOK_AHEAD_UNITS, MAX_BANK_DEG, MAX_LOOK_AHEAD_DEG, MAX_PITCH_DEG, RIG_MAX_PITCH_DEG, RIG_MAX_ROLL_DEG,
  airtimeAmount, bankAngle, createRigState, damp, dipAmount, dropAmount, lateralAcceleration, lookAheadDirection,
  onChainLift, pitchAngle, resetRig, rigAngles, sampleTrack, smoothingFactor, stepRig, triggerLaunch, verticalAcceleration,
  type RigAngles, type RigInput, type TrackSamples,
} from './cameraRig.hot'
import { buildArcTable, distanceAtT } from './arcLength'
import type { TrackCurve } from './curves/TrackCurve'

const DEG = Math.PI / 180

/** A rig input: a straight, level track at `speed` unless overridden. */
const ride = (over: Partial<RigInput> = {}): RigInput => ({
  lateral: 0, vertical: 0, speed: 100, speedNorm: 0, descent: 0, lifting: false, ...over,
})
const DT = 1 / 60

const angleBetween = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
  Math.acos(Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z)) / DEG

describe('smoothing', () => {
  it('is frame-rate independent: two half steps equal one full step', () => {
    const one = damp(0, 1, BANK_RESPONSE, 0.1)
    const two = damp(damp(0, 1, BANK_RESPONSE, 0.05), 1, BANK_RESPONSE, 0.05)
    expect(two).toBeCloseTo(one, 12)
  })

  it('holds still on a frozen frame and never overshoots on a long one', () => {
    expect(smoothingFactor(0, 5)).toBe(0)
    expect(smoothingFactor(-1, 5)).toBe(0)
    expect(smoothingFactor(10, 5)).toBeLessThanOrEqual(1)
    expect(damp(0, 1, 5, 10)).toBeLessThanOrEqual(1)
  })
})

describe('bank and pitch', () => {
  it('rolls toward the inside of the turn', () => {
    // Left turn: acceleration points left (negative along the right axis) -> positive rotateZ.
    expect(bankAngle(-100, 1)).toBeGreaterThan(0)
    expect(bankAngle(100, 1)).toBeLessThan(0)
    expect(bankAngle(0, 1)).toBeCloseTo(0, 12)
  })

  it('saturates at the cap and scales with the track', () => {
    expect(Math.abs(bankAngle(1e9, 1))).toBeCloseTo((MAX_BANK_DEG + HIGH_G_BANK_DEG) * DEG, 9)
    const u = Math.tanh(1)
    expect(Math.abs(bankAngle(LATERAL_ACCEL_REF, 1))).toBeCloseTo((u * MAX_BANK_DEG + u ** 3 * HIGH_G_BANK_DEG) * DEG, 9)
    expect(bankAngle(2 * LATERAL_ACCEL_REF, 2)).toBeCloseTo(bankAngle(LATERAL_ACCEL_REF, 1), 12)
    expect(bankAngle(Number.NaN, 1)).toBe(0)
  })

  it('banks harder into high-G turns while gentle ones keep their old bank', () => {
    const old = (a: number) => MAX_BANK_DEG * DEG * Math.tanh(a / LATERAL_ACCEL_REF)
    expect(Math.abs(bankAngle(10, 1)) / old(10)).toBeLessThan(1.01)
    expect(Math.abs(bankAngle(300, 1)) - old(300)).toBeGreaterThan(3.5 * DEG)
  })

  it('pitches up when speeding up and down when braking, within the cap', () => {
    expect(pitchAngle(100, 1)).toBeGreaterThan(0)
    expect(pitchAngle(-100, 1)).toBeLessThan(0)
    expect(Math.abs(pitchAngle(-1e9, 1))).toBeCloseTo(MAX_PITCH_DEG * DEG, 9)
    expect(pitchAngle(Number.POSITIVE_INFINITY, 1)).toBe(0)
  })
})

describe('dropAmount', () => {
  it('is 0 on the flat and climbs, 1 on steep drops, monotonic in between', () => {
    expect(dropAmount(0)).toBe(0)
    expect(dropAmount(-0.5)).toBe(0)
    expect(dropAmount(0.05)).toBe(0)
    expect(dropAmount(0.45)).toBe(1)
    expect(dropAmount(0.9)).toBe(1)
    expect(dropAmount(Number.NaN)).toBe(0)
    let prev = 0
    for (let d = 0; d <= 0.5; d += 0.01) {
      expect(dropAmount(d)).toBeGreaterThanOrEqual(prev)
      prev = dropAmount(d)
    }
  })
})

describe('stepRig', () => {
  it('eases into a sustained turn and settles at its bank angle', () => {
    const s = createRigState()
    stepRig(s, ride({ lateral: -150, speedNorm: 0.5 }), DT, 1)
    expect(s.roll).toBeGreaterThan(0)
    expect(s.roll).toBeLessThan(bankAngle(-150, 1) / 2)
    for (let i = 0; i < 600; i++) stepRig(s, ride({ lateral: -150, speedNorm: 0.5 }), DT, 1)
    expect(s.roll).toBeCloseTo(bankAngle(-150, 1), 6)
    expect(s.pitch).toBeCloseTo(0, 6) // constant speed
    expect(s.speedNorm).toBeCloseTo(0.5, 6)
  })

  it('pitches from the change in speed, not the speed itself', () => {
    const s = createRigState()
    stepRig(s, ride(), DT, 1) // first frame after a reset: no acceleration yet
    expect(s.pitch).toBe(0)
    for (let i = 1; i <= 60; i++) stepRig(s, ride({ speed: 100 + i * 2 }), DT, 1) // +120 units/s²
    expect(s.pitch).toBeGreaterThan(0)
    expect(s.pitch).toBeLessThanOrEqual(MAX_PITCH_DEG * DEG)
  })

  it('eases toward the drop amount of the current descent', () => {
    const s = createRigState()
    for (let i = 0; i < 600; i++) stepRig(s, ride({ descent: 0.6 }), DT, 1)
    expect(s.drop).toBeCloseTo(1, 6)
    for (let i = 0; i < 600; i++) stepRig(s, ride({ descent: -0.3 }), DT, 1)
    expect(s.drop).toBeCloseTo(0, 6)
  })

  it('is untouched by frozen frames and cleared by a reset', () => {
    const s = createRigState()
    triggerLaunch(s)
    for (let i = 0; i < 30; i++) stepRig(s, ride({ lateral: 200, speed: 100 + i, speedNorm: 1, descent: 0.5, vertical: -200, lifting: true }), DT, 1)
    const before = { ...s }
    stepRig(s, ride({ lateral: -500, speed: 0 }), 0, 1)
    expect(s).toEqual(before)
    resetRig(s)
    expect(s).toEqual(createRigState())
  })
})

describe('ride feel (#697)', () => {
  const angles = (s: ReturnType<typeof createRigState>): RigAngles => rigAngles(s, { pitch: 0, yaw: 0, roll: 0 })

  it('a launch tips the view up at once and fades within a few seconds', () => {
    const s = triggerLaunch(createRigState())
    for (let i = 0; i < 15; i++) stepRig(s, ride(), DT, 1)
    expect(s.launch).toBeGreaterThan(0.6)
    expect(angles(s).pitch).toBeGreaterThan(0.6 * LAUNCH_PITCH_DEG * DEG)
    for (let i = 0; i < 4 * 60; i++) stepRig(s, ride(), DT, 1)
    expect(s.launch).toBeLessThan(0.01)
  })

  it('dips the view entering a drop, then recovers while the drop holds', () => {
    const s = createRigState()
    let deepest = 0
    for (let i = 0; i < 20; i++) {
      stepRig(s, ride({ descent: 0.6 }), DT, 1)
      deepest = Math.min(deepest, angles(s).pitch)
    }
    expect(deepest).toBeLessThan(-0.4 * DIP_DEG * DEG)
    for (let i = 0; i < 5 * 60; i++) stepRig(s, ride({ descent: 0.6 }), DT, 1)
    expect(dipAmount(s)).toBeLessThan(0.01)
    expect(s.drop).toBeCloseTo(1, 3)
  })

  it('floats over an airtime crest: the view lifts and drifts slowly, and settles off it', () => {
    expect(airtimeAmount(0, 1)).toBe(0)
    expect(airtimeAmount(500, 1)).toBe(0)
    expect(airtimeAmount(-1000, 1)).toBe(1)
    expect(airtimeAmount(-2000, 2)).toBe(1)
    expect(airtimeAmount(Number.NaN, 1)).toBe(0)
    const s = createRigState()
    for (let i = 0; i < 60; i++) stepRig(s, ride({ vertical: -500 }), DT, 1)
    expect(s.airtime).toBeGreaterThan(0.9)
    let lo = Infinity
    let hi = -Infinity
    for (let i = 0; i < 3 * 60; i++) {
      stepRig(s, ride({ vertical: -500 }), DT, 1)
      const a = angles(s)
      lo = Math.min(lo, a.pitch)
      hi = Math.max(hi, a.pitch)
      expect(Math.abs(a.yaw)).toBeLessThanOrEqual(FLOAT_DRIFT_DEG * DEG)
    }
    expect(lo).toBeGreaterThan(0)
    expect(hi - lo).toBeGreaterThan(0.2 * FLOAT_DRIFT_DEG * DEG)
    expect(hi).toBeLessThanOrEqual((FLOAT_PITCH_DEG + FLOAT_DRIFT_DEG) * DEG)
    for (let i = 0; i < 3 * 60; i++) stepRig(s, ride(), DT, 1)
    expect(Math.abs(angles(s).pitch) + Math.abs(angles(s).yaw)).toBeLessThan(0.05 * DEG)
  })

  it('a crest bends the tangent down: negative vertical acceleration growing with speed squared', () => {
    const up = { x: 0.9, y: 0.3, z: 0 }
    const down = { x: 0.9, y: -0.3, z: 0 }
    expect(verticalAcceleration(up, down, 10, 50)).toBeCloseTo(-0.06 * 2500, 9)
    expect(verticalAcceleration(down, up, 10, 50)).toBeGreaterThan(0)
    expect(verticalAcceleration(up, down, 0, 50)).toBe(0)
  })

  it('is on the chain only climbing at the minimum speed', () => {
    expect(onChainLift(0.3, 0.001, 0.001)).toBe(true)
    expect(onChainLift(0.3, 0.002, 0.001)).toBe(false)
    expect(onChainLift(0, 0.001, 0.001)).toBe(false)
    expect(onChainLift(-0.3, 0.001, 0.001)).toBe(false)
  })

  it('stays inside the smoke caps with every term at its worst', () => {
    const s = createRigState()
    let roll = 0
    let pitch = 0
    for (let i = 0; i < 10 * 60; i++) {
      if (i % 120 === 0) triggerLaunch(s)
      stepRig(s, ride({ lateral: (i % 90 < 45 ? 1 : -1) * 1e4, speed: 100 + (i % 30) * 20, vertical: -1e4, descent: i % 60 < 30 ? 1 : 0 }), DT, 1)
      const a = angles(s)
      roll = Math.max(roll, Math.abs(a.roll))
      pitch = Math.max(pitch, Math.abs(a.pitch))
    }
    expect(roll).toBeLessThanOrEqual(RIG_MAX_ROLL_DEG * DEG)
    expect(pitch).toBeLessThanOrEqual(RIG_MAX_PITCH_DEG * DEG)
  })
})

describe('lookAheadDirection', () => {
  it('looks straight along the tangent on a straight track', () => {
    const out = { x: 0, y: 0, z: 0 }
    lookAheadDirection({ x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: -1 }, out)
    expect(out).toEqual({ x: 0, y: 0, z: -1 })
  })

  it('glances part way into a gentle curve', () => {
    const ahead = { x: Math.sin(10 * DEG), y: 0, z: -Math.cos(10 * DEG) }
    const out = lookAheadDirection({ x: 0, y: 0, z: -1 }, ahead, { x: 0, y: 0, z: 0 })
    expect(Math.hypot(out.x, out.y, out.z)).toBeCloseTo(1, 12)
    expect(out.x).toBeGreaterThan(0)
    expect(angleBetween(out, { x: 0, y: 0, z: -1 })).toBeCloseTo(5, 6)
  })

  it('never turns more than the cap off the tangent', () => {
    const tangent = { x: 0, y: 0, z: -1 }
    const ahead = { x: 1, y: 0, z: 0 } // 90° turn
    const out = lookAheadDirection(tangent, ahead, { x: 0, y: 0, z: 0 })
    expect(angleBetween(out, tangent)).toBeCloseTo(MAX_LOOK_AHEAD_DEG, 6)
    expect(out.x).toBeGreaterThan(0)
  })

  it('may write into its own input', () => {
    const v = { x: Math.sin(10 * DEG), y: 0, z: -Math.cos(10 * DEG) }
    lookAheadDirection({ x: 0, y: 0, z: -1 }, v, v)
    expect(angleBetween(v, { x: 0, y: 0, z: -1 })).toBeCloseTo(5, 6)
  })
})

/** ds/dt swings ±75% around the loop. */
const UNEVEN = 0.12

/** Flat circle of radius R, ridden unevenly in t like the trig tracks; `dir` -1 rides it the other way round. */
function unevenCircle(R: number, dir = 1): TrackCurve {
  const angle = (t: number) => dir * 2 * Math.PI * (t + UNEVEN * Math.sin(2 * Math.PI * t))
  return {
    getPointAt: (t) => new THREE.Vector3(R * Math.cos(angle(t)), 0, R * Math.sin(angle(t))),
    getTangentAt: (t) => {
      const a = angle(t)
      return new THREE.Vector3(-Math.sin(a) * dir, 0, Math.cos(a) * dir)
    },
  }
}

const freshSamples = (): TrackSamples => ({ behindT: 0, aheadT: 0, lookT: 0, span: 0, unitsPerT: 0 })

describe('sampleTrack', () => {
  const R = 200
  const table = buildArcTable(unevenCircle(R))
  const length = 2 * Math.PI * R
  const arc = (from: number, to: number) =>
    (((distanceAtT(table, to) - distanceAtT(table, from)) % length) + length) % length

  it('looks a constant arc distance ahead on an uneven curve, across the loop seam', () => {
    for (const trackScale of [1, 2.5]) {
      for (const t of [0, 0.1, 0.23, 0.5, 0.74, 0.9, 0.995]) {
        const s = sampleTrack(table, t, trackScale, freshSamples())
        expect(arc(t, s.lookT)).toBeCloseTo(LOOK_AHEAD_UNITS * trackScale, 3)
        expect(arc(s.behindT, t)).toBeCloseTo(CURVATURE_SAMPLE_UNITS * trackScale, 3)
        expect(arc(t, s.aheadT)).toBeCloseTo(CURVATURE_SAMPLE_UNITS * trackScale, 3)
        expect(s.span).toBeCloseTo(2 * CURVATURE_SAMPLE_UNITS * trackScale, 9)
      }
    }
  })

  it('gives units per t from the track speed at the car', () => {
    for (const t of [0, 0.25, 0.5, 0.75]) {
      const dsdt = length * (1 + UNEVEN * 2 * Math.PI * Math.cos(2 * Math.PI * t))
      expect(sampleTrack(table, t, 1, freshSamples()).unitsPerT / dsdt).toBeCloseTo(1, 2)
    }
  })
})

describe('lateralAcceleration', () => {
  const R = 150
  const speed = 60
  const accelAt = (dir: number, t: number) => {
    const curve = unevenCircle(R, dir)
    const s = sampleTrack(buildArcTable(curve), t, 1, freshSamples())
    const tangent = curve.getTangentAt(t)
    return lateralAcceleration(tangent, curve.getTangentAt(s.behindT), curve.getTangentAt(s.aheadT), s.span, speed)
  }

  it('is v²/R toward the centre of a circle, positive on a right turn', () => {
    for (const t of [0, 0.3, 0.6, 0.97]) {
      // dir 1 runs clockwise seen from above (+y), so the centre is on the camera's right (tangent × up).
      expect(accelAt(1, t) / ((speed * speed) / R)).toBeCloseTo(1, 3)
      expect(accelAt(-1, t) / (-(speed * speed) / R)).toBeCloseTo(1, 3)
    }
  })

  it('is 0 on a straight, a vertical tangent or an empty span', () => {
    const x = { x: 1, y: 0, z: 0 }
    const z = { x: 0, y: 0, z: 1 }
    expect(lateralAcceleration(x, x, x, 8, speed)).toBe(0)
    expect(lateralAcceleration({ x: 0, y: 1, z: 0 }, x, z, 8, speed)).toBe(0)
    expect(lateralAcceleration(x, x, z, 0, speed)).toBe(0)
  })
})
