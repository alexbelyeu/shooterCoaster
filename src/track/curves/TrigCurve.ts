import * as THREE from 'three'
import type { TrackCurve } from './TrackCurve'

const PI2 = Math.PI * 2

/**
 * Direct port of original Curve1.js
 * Parametric rollercoaster curve using trig functions.
 */
export function createTrigCurve(
  varA: number,
  varB: number,
  varC: number,
  scalar: number,
): TrackCurve {
  const _point = new THREE.Vector3()
  const _tangent = new THREE.Vector3()
  // Need separate vectors for tangent computation (getPointAt called twice)
  const _p1 = new THREE.Vector3()
  const _p2 = new THREE.Vector3()

  function computePoint(t: number, out: THREE.Vector3): THREE.Vector3 {
    const angle = t * PI2
    const x = Math.sin(angle * varA) * Math.cos(angle * varC) * varC * 13
    const y = Math.cos(angle * varC * 2) * varC + Math.cos(angle * varB) + 5
    const z = Math.sin(angle) * Math.sin(angle * varC) * varC * 13
    return out.set(x, y, z).multiplyScalar(scalar)
  }

  return {
    getPointAt(t: number): THREE.Vector3 {
      return computePoint(t, _point)
    },

    getTangentAt(t: number): THREE.Vector3 {
      const delta = 0.0001
      const t1 = Math.max(0, t - delta)
      const t2 = Math.min(1, t + delta)
      computePoint(t2, _p2)
      computePoint(t1, _p1)
      return _tangent.copy(_p2).sub(_p1).normalize()
    },
  }
}
