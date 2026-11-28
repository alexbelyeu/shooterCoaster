import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { bossMaxScore, currentPhase, applyHit, createBossState, exposedWeakPoints } from './bossModel'
import { HELICOPTER } from './bossSpecs'
import {
  BEAM, HELI, HELI_FALL, HUB_LUNGE, LUNGE_PITCH, TAIL_LOST_WOBBLE, anchorAt, beamSpot, dropInHeight, fallDrop, fallSpin, heliPose,
  hubShut, lookSlope, lungePitch, spotAt, type BeamSpot, type HeliPose,
} from './helicopterMotion.hot'

const pose = (): HeliPose => ({ dy: 0, pitch: 0, roll: 0, yaw: 0, drop: 0 })
const times = (from: number, to: number, step = 0.05) => Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => from + i * step)

describe('the Helicopter spec', () => {
  it('the searchlight and the tail rotor first (3 hp, 60 each), then the hub (12 hp); 400 for bringing it down', () => {
    let state = createBossState(HELICOPTER)
    expect(exposedWeakPoints(state).map((w) => w.id).sort()).toEqual(['searchlight', 'tail-rotor'])
    for (const id of ['searchlight', 'searchlight', 'searchlight', 'tail-rotor', 'tail-rotor', 'tail-rotor']) state = applyHit(state, id)
    expect(currentPhase(state)).toBe(1)
    expect(exposedWeakPoints(state).map((w) => w.id)).toEqual(['hub'])
    expect(HELICOPTER.weakPoints.find((w) => w.id === 'hub')!.hp).toBe(14)
    expect(bossMaxScore(HELICOPTER)).toBe(60 + 60 + 400)
  })
})

describe('the Helicopter fights back (#1059)', () => {
  it('shows its hub only in its lunges, nose down', () => {
    expect(hubShut(0)).toBe(false)
    expect(hubShut(HUB_LUNGE.openS + 0.01)).toBe(true)
    expect(hubShut(HUB_LUNGE.period + 0.01)).toBe(false)
    expect(lungePitch(0)).toBe(0)
    expect(lungePitch(HUB_LUNGE.openS / 2)).toBeCloseTo(LUNGE_PITCH)
    expect(lungePitch(HUB_LUNGE.openS + 0.1)).toBe(0)
  })
})

describe('the Helicopter motion', () => {
  it('bobs, tilts and banks a little while it fights, and stays turned within its three-quarter view', () => {
    const p = pose()
    let maxDy = 0
    let maxYaw = 0
    for (const t of times(0, 40)) {
      heliPose(p, t, false, -1)
      maxDy = Math.max(maxDy, Math.abs(p.dy))
      maxYaw = Math.max(maxYaw, Math.abs(p.yaw))
      expect(p.pitch).toBeGreaterThan(0)
      expect(p.drop).toBe(0)
    }
    expect(maxDy).toBeGreaterThan(8)
    expect(maxDy).toBeLessThanOrEqual(16)
    expect(maxYaw).toBeLessThanOrEqual(HELI.quarter)
  })

  it('wobbles about its yaw once its tail rotor is gone', () => {
    const p = pose()
    const swing = (tailLost: boolean) => {
      let lo = Infinity
      let hi = -Infinity
      for (const t of times(10, 14)) {
        heliPose(p, t, tailLost, -1)
        lo = Math.min(lo, p.yaw)
        hi = Math.max(hi, p.yaw)
      }
      return hi - lo
    }
    expect(swing(true)).toBeGreaterThan(swing(false) + TAIL_LOST_WOBBLE.amplitude)
  })

  it('drops in from above its anchor over its first seconds', () => {
    expect(dropInHeight(0)).toBe(HELI.dropIn)
    expect(dropInHeight(HELI.dropSeconds / 2)).toBeLessThan(HELI.dropIn)
    expect(dropInHeight(HELI.dropSeconds)).toBe(0)
    expect(dropInHeight(30)).toBe(0)
  })

  it('on its defeat spins up and falls out of view before it leaves, faster and faster', () => {
    expect(fallSpin(0)).toBe(0)
    expect(fallDrop(0)).toBe(0)
    let lastSpin = 0
    let lastDrop = 0
    let lastRate = 0
    for (const t of times(0.05, HELI_FALL.exitSeconds)) {
      const spin = fallSpin(t)
      const drop = fallDrop(t)
      expect(spin).toBeGreaterThan(lastSpin)
      expect(drop).toBeGreaterThan(lastDrop)
      expect(spin - lastSpin).toBeGreaterThanOrEqual(lastRate - 1e-9)
      lastRate = spin - lastSpin
      lastSpin = spin
      lastDrop = drop
    }
    // Continuous where the spin's ramp ends.
    expect(fallSpin(HELI_FALL.spinRamp + 1e-6)).toBeCloseTo(fallSpin(HELI_FALL.spinRamp - 1e-6), 4)
    // From its lowest hover over the street it reaches the street well before it is gone.
    expect(fallDrop(HELI_FALL.exitSeconds * 0.7)).toBeGreaterThan(HELI.minClearance)
    const p = heliPose(pose(), 20, true, 2)
    expect(p.drop).toBe(fallDrop(2))
    expect(p.pitch).toBeCloseTo(HELI_FALL.pitch, 5)
  })

  it('sweeps its searchlight across the street ahead of the rider, and brings it in from off the side in the tell', () => {
    const s: BeamSpot = { ahead: 0, side: 0 }
    let left = 0
    let right = 0
    for (const t of times(0, 20)) {
      beamSpot(s, t)
      expect(s.ahead).toBeGreaterThanOrEqual(BEAM.ahead - BEAM.aheadSwing)
      expect(s.ahead).toBeLessThan(HELI.ahead)
      expect(Math.abs(s.side)).toBeLessThanOrEqual(BEAM.side)
      left = Math.min(left, s.side)
      right = Math.max(right, s.side)
    }
    expect(right - left).toBeGreaterThan(1.8 * BEAM.side)
    expect(Math.abs(beamSpot(s, 0, 0).side)).toBeGreaterThan(BEAM.tellSide * 0.9)
    expect(Math.abs(beamSpot(s, 0, 0.5).side)).toBeLessThan(BEAM.tellSide * 0.9)
    expect(beamSpot(s, 1, 1).side).toBe(beamSpot(s, 1).side)
  })
  it('hovers ahead of the camera on the rider\'s heading, within `side` of it, above the camera and clear of the street', () => {
    const cam = new THREE.Vector3(40, 120, -300)
    const out = new THREE.Vector3()
    const ground = (x: number, z: number) => 60 + 0.2 * x + 0.1 * z
    let minAhead = Infinity
    let maxAhead = -Infinity
    let maxSide = 0
    let minAbove = Infinity
    let minClear = Infinity
    for (const a of [0, 0.7, 2, Math.PI, 4.5]) {
      const h = { x: Math.sin(a), z: -Math.cos(a) }
      for (const t of times(0, 40, 0.25)) {
        anchorAt(out, cam, h, t, ground)
        const dx = out.x - cam.x
        const dz = out.z - cam.z
        minAhead = Math.min(minAhead, dx * h.x + dz * h.z)
        maxAhead = Math.max(maxAhead, dx * h.x + dz * h.z)
        maxSide = Math.max(maxSide, Math.abs(dz * h.x - dx * h.z))
        minAbove = Math.min(minAbove, out.y - (cam.y + HELI.above))
        minClear = Math.min(minClear, out.y - (ground(out.x, out.z) + HELI.minClearance))
      }
    }
    expect(minAhead).toBeCloseTo(HELI.ahead, 6)
    expect(maxAhead).toBeCloseTo(HELI.ahead, 6)
    expect(maxSide).toBeLessThanOrEqual(HELI.side + 1e-9)
    expect(maxSide).toBeGreaterThan(HELI.side * 0.95)
    expect(minAbove).toBeGreaterThanOrEqual(0)
    expect(minClear).toBeGreaterThanOrEqual(0)
    // Over high ground it climbs to keep its clearance.
    expect(anchorAt(out, cam, { x: 0, z: -1 }, 0, () => 500).y).toBe(500 + HELI.minClearance)
  })

  it('follows the camera down a descent so it stays in frame, never under its street clearance (#966)', () => {
    const out = new THREE.Vector3()
    const cam = new THREE.Vector3(0, 300, 0)
    const level = anchorAt(out, cam, { x: 0, z: -1 }, 0, () => 0).y
    // Looking down a 1-in-5 descent: the point it hovers over drops with the view centre 560 ahead.
    const down = anchorAt(out, cam, { x: 0, z: -1 }, 0, () => 0, lookSlope({ x: 0, y: -0.2, z: -1 })).y
    expect(level - down).toBeCloseTo(0.2 * HELI.ahead, 6)
    // A steep look is held to `maxLookSlope`, and the street floor still holds.
    expect(anchorAt(out, cam, { x: 0, z: -1 }, 0, () => 0, -5).y).toBe(Math.max(300 - HELI.maxLookSlope * HELI.ahead + HELI.above, HELI.minClearance))
    expect(anchorAt(out, new THREE.Vector3(0, 30, 0), { x: 0, z: -1 }, 0, () => 0, -0.4).y).toBe(HELI.minClearance)
    expect(lookSlope({ x: 0, y: -1, z: 0 })).toBe(0)
  })

  it('lands the searchlight\'s spot on the street, `ahead` along the heading and `side` to its right', () => {
    const out = new THREE.Vector3()
    const spot = spotAt(out, new THREE.Vector3(10, 200, 20), { x: 0, z: -1 }, { ahead: 300, side: 50 }, () => 7)
    expect([spot.x, spot.y, spot.z]).toEqual([60, 8, -280])
  })
})
