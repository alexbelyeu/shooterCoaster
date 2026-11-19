import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createSplineCurve } from '../curves/SplineCurve'
import { buildArcTable } from '../arcLength'
import { buildTrackGeometry, seatUp, trackFrame } from '../trackGeometry'
import { getTrackDimensions } from '../trackDimensions'
import { DEMO_EYE, buildDemoRide, markerT } from './demoRide'
import { airtimeHill, corkscrew, heartlineRoll, helix, verticalLoop, zeroGRoll } from './elements'
import { HEAD_CHOPPER_GAP, eyeClearance, headChopper } from './headChopper'
import { RideBuilder, type ElementKind } from './rideBuilder'

const ride = buildDemoRide()
const { curve } = ride
const SAMPLES = 6000

/** Min / max of f(t) over a marker's span. */
function overSpan(kind: ElementKind | 'slowMotion', f: (t: number) => number, index = 0) {
  const from = markerT(ride, kind, 0, index)
  const to = markerT(ride, kind, 1, index)
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i <= 400; i++) {
    const v = f(from + ((to - from) * i) / 400)
    min = Math.min(min, v)
    max = Math.max(max, v)
  }
  return { min, max }
}

const upY = (t: number) => curve.getUpAt!(t).y

/** A builder's frame after one element from a level start heading +z. */
function after(build: (b: RideBuilder) => void) {
  const b = new RideBuilder({ x: 0, y: 0, z: 0, eyeHeight: DEMO_EYE })
  build(b)
  return b
}

describe('ride elements (#698)', () => {
  it('the demo circuit is continuous in position, tangent and up, round the seam', () => {
    let maxStep = 0
    let maxTurn = 0
    let maxRoll = 0
    let maxSkew = 0
    const p0 = curve.getPointAt(0).clone()
    const f0 = curve.getTangentAt(0).clone()
    const u0 = curve.getUpAt!(0).clone()
    const p = p0.clone()
    const f = f0.clone()
    const u = u0.clone()
    for (let i = 1; i <= SAMPLES; i++) {
      const t = i / SAMPLES
      const np = curve.getPointAt(t)
      const nf = curve.getTangentAt(t)
      maxStep = Math.max(maxStep, np.distanceTo(p))
      maxTurn = Math.max(maxTurn, nf.angleTo(f))
      p.copy(np)
      f.copy(nf)
      const nu = curve.getUpAt!(t)
      maxRoll = Math.max(maxRoll, nu.angleTo(u))
      maxSkew = Math.max(maxSkew, Math.abs(nu.dot(nf)))
      u.copy(nu)
    }
    const length = buildArcTable(curve).length
    expect(maxStep).toBeLessThan((length / SAMPLES) * 1.05)
    // Per step (~0.2 units): no kink, no snap of the up.
    expect(maxTurn).toBeLessThan(0.05)
    expect(maxRoll).toBeLessThan(0.05)
    expect(maxSkew).toBeLessThan(1e-9)
  })

  it('every inversion has the rider upside down at its apex', () => {
    for (const kind of ['verticalLoop', 'zeroGRoll', 'corkscrew', 'heartlineRoll'] as const) {
      expect(overSpan(kind, upY).min, kind).toBeLessThan(-0.97)
    }
    for (const kind of ['airtimeHill', 'helix', 'bankedTurn', 'headChopper'] as const) {
      expect(overSpan(kind, upY).min, kind).toBeGreaterThan(0.3)
    }
  })

  it("the loop's apex is above its entry by twice its radius, with the rider's head toward the middle", () => {
    const entry = curve.getPointAt(markerT(ride, 'verticalLoop', 0)).y
    const top = overSpan('verticalLoop', (t) => curve.getPointAt(t).y).max
    expect(top - entry).toBeCloseTo(2 * 3.5 * DEMO_EYE, 0)
    const apex = markerT(ride, 'verticalLoop', 0.5)
    expect(curve.getUpAt!(apex).y).toBeLessThan(-0.97)
  })

  it('each element exits upright on its entry heading; the loop and the corkscrew to the side', () => {
    const cases: [string, (b: RideBuilder) => void, number][] = [
      ['loop', (b) => verticalLoop(b), 1.2 * DEMO_EYE],
      ['corkscrew', (b) => corkscrew(b), -1],
      ['zero-g roll', (b) => zeroGRoll(b), 0],
      ['heartline roll', (b) => heartlineRoll(b), 0],
      ['airtime hill', (b) => airtimeHill(b), 0],
      ['helix', (b) => helix(b), 0],
    ]
    for (const [name, build, side] of cases) {
      const b = after(build)
      expect(b.forward.z, name).toBeCloseTo(1, 6)
      expect(b.up.y, name).toBeCloseTo(1, 6)
      const last = b.points[b.points.length - 1]
      expect(last.up!.y, name).toBeGreaterThan(0.99)
      if (side > 0) expect(b.position.x / side, name).toBeGreaterThan(0.8)
      else if (side < 0) expect(b.position.x, name).toBeGreaterThan(DEMO_EYE)
      else expect(Math.abs(b.position.x), name).toBeLessThan(1e-6)
    }
    expect(after((b) => helix(b, { drop: 12 })).position.y).toBeCloseTo(-12, 4)
    expect(after((b) => airtimeHill(b, { rise: 10 })).position.y).toBeCloseTo(0, 6)
  })

  it('neighbouring control points roll at most ~35° apart, so the splined up never flips', () => {
    const b = new RideBuilder({ x: 0, y: 0, z: 0, eyeHeight: DEMO_EYE })
    verticalLoop(b)
    zeroGRoll(b)
    corkscrew(b)
    heartlineRoll(b)
    helix(b)
    let worst = 0
    for (let i = 1; i < b.points.length; i++) {
      const a = b.points[i - 1].up!
      const c = b.points[i].up!
      worst = Math.max(worst, Math.acos(Math.min(1, a.x * c.x + a.y * c.y + a.z * c.z)))
    }
    expect(worst).toBeLessThan((35 * Math.PI) / 180)
  })

  it("a heartline roll keeps the rider's heart on a straight line while the rails swing round it", () => {
    const { min, max } = overSpan('heartlineRoll', (t) => curve.getPointAt(t).y + curve.getUpAt!(t).y * 0.6 * DEMO_EYE)
    expect(max - min).toBeLessThan(0.5)
  })

  it("the airtime hill's slow-motion window holds its crest", () => {
    const crest = overSpan('airtimeHill', (t) => curve.getPointAt(t).y).max
    expect(overSpan('slowMotion', (t) => curve.getPointAt(t).y).max).toBeCloseTo(crest, 1)
  })

  it('the helix banks into its turn and turns a whole circle', () => {
    // hand -1 turns right: the up leans right (−x of the frame's left), toward the helix's middle.
    const t = markerT(ride, 'helix', 0.5)
    const up = curve.getUpAt!(t)
    const f = curve.getTangentAt(t)
    const left = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), f).normalize()
    expect(up.dot(left)).toBeLessThan(-0.5)
    const heading = (k: number) => curve.getTangentAt(markerT(ride, 'helix', k))
    expect(heading(0).angleTo(heading(1))).toBeLessThan(0.02)
  })

  it('the head-chopper passes the eye its gap under the beam, and refuses a pass under the clearance', () => {
    const near = eyeClearance(curve, ride.beam, DEMO_EYE, markerT(ride, 'headChopper', 0), markerT(ride, 'headChopper', 1))
    expect(near).toBeGreaterThan(HEAD_CHOPPER_GAP - 0.1)
    expect(near).toBeLessThan(HEAD_CHOPPER_GAP + 0.1)
    expect(eyeClearance(curve, ride.beam, DEMO_EYE)).toBeGreaterThan(HEAD_CHOPPER_GAP - 0.1)
    const wall = { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 10, z: 10 } }
    expect(headChopper(wall, { x: 1, y: 0, z: 0 }, { eyeHeight: 6, clearance: 0.8 }).rail).toEqual({ x: 2, y: -1, z: 5 })
    expect(() => headChopper(wall, { x: 1, y: 0, z: 0 }, { eyeHeight: 6, clearance: 0.8, gap: 0.5 })).toThrow(/clearance/)
  })

  it('the track frame follows the roll: right = up × forward, and the rails build upside down', () => {
    const t = markerT(ride, 'verticalLoop', 0.5)
    const [p, f, r, u] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
    trackFrame(curve, t, p, f, r, u)
    expect(u.y).toBeLessThan(-0.97)
    expect(u.dot(curve.getUpAt!(t))).toBeCloseTo(1, 9)
    const table = buildArcTable(curve)
    const geometry = buildTrackGeometry(curve, table, getTrackDimensions({ scalar: 20 }), 2000, [1, 0, 0], [0, 0, 1])
    const pos = geometry.getAttribute('position').array
    expect(Array.from(pos).every(Number.isFinite)).toBe(true)
    geometry.dispose()
  })

  it('a track without ups never rolls: no getUpAt, world up for the seat', () => {
    const plain = createSplineCurve([
      { x: 0, y: 0, z: 0 },
      { x: 100, y: 10, z: 0 },
      { x: 100, y: 0, z: 100 },
      { x: 0, y: -10, z: 100 },
    ])
    expect(plain.getUpAt).toBeUndefined()
    expect(seatUp(plain, 0.3, new THREE.Vector3()).toArray()).toEqual([0, 1, 0])
  })

  it('aim maps screen to world upside down: a target up-screen is toward the rails, and the ray through it hits it', () => {
    const t = markerT(ride, 'verticalLoop', 0.5)
    const cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 1000)
    const up = seatUp(curve, t, new THREE.Vector3())
    // Posed the way CoasterCamera poses it.
    cam.position.copy(curve.getPointAt(t)).addScaledVector(up, DEMO_EYE)
    cam.up.copy(up)
    cam.lookAt(cam.position.clone().add(curve.getTangentAt(t)))
    cam.updateMatrixWorld()
    const target = cam.position.clone().addScaledVector(curve.getTangentAt(t), 40).addScaledVector(up, 8)
    const ndc = target.clone().project(cam)
    expect(ndc.y).toBeGreaterThan(0.1)
    expect(Math.abs(ndc.x)).toBeLessThan(1e-6)
    const ray = new THREE.Raycaster()
    ray.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), cam)
    expect(ray.ray.distanceToPoint(target)).toBeLessThan(1e-4)
    // The world's up is down-screen: the ground is overhead.
    expect(new THREE.Vector3(0, 1, 0).transformDirection(cam.matrixWorldInverse).y).toBeLessThan(-0.9)
  })
})
