import * as THREE from 'three'
import type { TrackCurve } from './TrackCurve'

/**
 * CatmullRomCurve3 wrapper for hand-crafted campaign tracks.
 * Accepts an array of control points and wraps Three.js spline.
 */
export function createSplineCurve(points: THREE.Vector3[]): TrackCurve {
  const spline = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5)
  const _point = new THREE.Vector3()
  const _tangent = new THREE.Vector3()

  return {
    getPointAt(t: number): THREE.Vector3 {
      spline.getPointAt(t, _point)
      return _point
    },

    getTangentAt(t: number): THREE.Vector3 {
      spline.getTangentAt(t, _tangent)
      return _tangent
    },
  }
}
