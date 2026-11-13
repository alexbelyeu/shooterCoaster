import * as THREE from 'three'
import type { TrackCurve } from './TrackCurve'

export interface Point3 {
  x: number
  y: number
  z: number
}

/** Arc-length samples per segment: getPointAt interpolates between them. */
const SAMPLES_PER_SEGMENT = 64

/**
 * A closed centripetal Catmull-Rom spline through `points` (an authored track, #514). `t` is arc
 * length (0..1 once round the loop, wrapping), so the ride's speed rule and the arc table read it
 * like the trig curves; the tangent is the spline's own derivative, continuous across the seam.
 * Centripetal (alpha 0.5) never cusps or loops between close points.
 */
export function createSplineCurve(points: readonly Point3[]): TrackCurve {
  const n = points.length
  if (n < 4) throw new Error(`a closed spline needs at least 4 points, got ${n}`)
  // Per segment and axis, the cubic c0 + c1 u + c2 u² + c3 u³ over u in [0, 1].
  const coef = new Float64Array(n * 12)
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n]
    const p1 = points[i]
    const p2 = points[(i + 1) % n]
    const p3 = points[(i + 2) % n]
    let dt0 = Math.pow(dist2(p0, p1), 0.25)
    let dt1 = Math.pow(dist2(p1, p2), 0.25)
    let dt2 = Math.pow(dist2(p2, p3), 0.25)
    if (dt1 < 1e-4) dt1 = 1
    if (dt0 < 1e-4) dt0 = dt1
    if (dt2 < 1e-4) dt2 = dt1
    initAxis(coef, i * 12, p0.x, p1.x, p2.x, p3.x, dt0, dt1, dt2)
    initAxis(coef, i * 12 + 4, p0.y, p1.y, p2.y, p3.y, dt0, dt1, dt2)
    initAxis(coef, i * 12 + 8, p0.z, p1.z, p2.z, p3.z, dt0, dt1, dt2)
  }

  const count = n * SAMPLES_PER_SEGMENT
  const cumulative = new Float64Array(count + 1)
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  evaluate(coef, 0, 0, a)
  for (let k = 1; k <= count; k++) {
    const g = k / SAMPLES_PER_SEGMENT
    const seg = Math.min(Math.floor(g), n - 1)
    evaluate(coef, seg, g - seg, b)
    cumulative[k] = cumulative[k - 1] + a.distanceTo(b)
    a.copy(b)
  }
  const length = cumulative[count]

  /** Segment index and local u at arc fraction t. */
  let segment = 0
  let local = 0
  function locate(t: number): void {
    const s = (((t % 1) + 1) % 1) * length
    let lo = 0
    let hi = count
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (cumulative[mid] <= s) lo = mid
      else hi = mid
    }
    const span = cumulative[hi] - cumulative[lo]
    const g = (lo + (span > 0 ? (s - cumulative[lo]) / span : 0)) / SAMPLES_PER_SEGMENT
    segment = Math.min(Math.floor(g), n - 1)
    local = g - segment
  }

  const point = new THREE.Vector3()
  const tangent = new THREE.Vector3()
  return {
    getPointAt(t: number): THREE.Vector3 {
      locate(t)
      return evaluate(coef, segment, local, point)
    },
    getTangentAt(t: number): THREE.Vector3 {
      locate(t)
      const o = segment * 12
      tangent.set(derivative(coef, o, local), derivative(coef, o + 4, local), derivative(coef, o + 8, local))
      return tangent.normalize()
    },
  }
}

function dist2(p: Point3, q: Point3): number {
  return (p.x - q.x) ** 2 + (p.y - q.y) ** 2 + (p.z - q.z) ** 2
}

/** three.js CatmullRomCurve3's non-uniform Catmull-Rom (its CubicPoly), one axis into `coef` at `o`. */
function initAxis(coef: Float64Array, o: number, x0: number, x1: number, x2: number, x3: number, dt0: number, dt1: number, dt2: number): void {
  const t1 = ((x1 - x0) / dt0 - (x2 - x0) / (dt0 + dt1) + (x2 - x1) / dt1) * dt1
  const t2 = ((x2 - x1) / dt1 - (x3 - x1) / (dt1 + dt2) + (x3 - x2) / dt2) * dt1
  coef[o] = x1
  coef[o + 1] = t1
  coef[o + 2] = -3 * x1 + 3 * x2 - 2 * t1 - t2
  coef[o + 3] = 2 * x1 - 2 * x2 + t1 + t2
}

function cubic(coef: Float64Array, o: number, u: number): number {
  return coef[o] + u * (coef[o + 1] + u * (coef[o + 2] + u * coef[o + 3]))
}

function derivative(coef: Float64Array, o: number, u: number): number {
  return coef[o + 1] + u * (2 * coef[o + 2] + u * 3 * coef[o + 3])
}

function evaluate(coef: Float64Array, seg: number, u: number, out: THREE.Vector3): THREE.Vector3 {
  const o = seg * 12
  return out.set(cubic(coef, o, u), cubic(coef, o + 4, u), cubic(coef, o + 8, u))
}
