import * as THREE from 'three'
import type { TrackCurve } from '../curves/TrackCurve'
import type { Point3 } from '../curves/SplineCurve'
import { seatUp } from '../trackGeometry'

/** An axis-aligned solid: a beam, a ledge, a wall. */
export interface Box {
  min: Point3
  max: Point3
}

/** The gap a head-chopper leaves between the rider's eye and the solid. */
export const HEAD_CHOPPER_GAP = 1

const _p = new THREE.Vector3()
const _box = new THREE.Box3()

/** Distance from `p` to the box (0 inside). */
export function boxDistance(box: Box, p: Point3): number {
  _box.min.set(box.min.x, box.min.y, box.min.z)
  _box.max.set(box.max.x, box.max.y, box.max.z)
  return _box.distanceToPoint(_p.set(p.x, p.y, p.z))
}

/**
 * A head-chopper (#698): where the rails go to pass the rider's eye `gap` from a face of `box` (the face `toward`
 * looks out of: an axis direction, e.g. (0, -1, 0) under a beam, (1, 0, 0) beside a wall), at the middle of that
 * face. The car (rails to eye, along `up`) must stay `clearance` off the solid (a level's rail clearance), or it throws.
 * Route the track through `rail` with `up` there.
 */
export function headChopper(
  box: Box,
  toward: Point3,
  { eyeHeight, clearance, gap = HEAD_CHOPPER_GAP, up = { x: 0, y: 1, z: 0 } }: { eyeHeight: number; clearance: number; gap?: number; up?: Point3 },
): { rail: Point3; eye: Point3 } {
  const c = { x: (box.min.x + box.max.x) / 2, y: (box.min.y + box.max.y) / 2, z: (box.min.z + box.max.z) / 2 }
  const face = {
    x: toward.x > 0 ? box.max.x : toward.x < 0 ? box.min.x : c.x,
    y: toward.y > 0 ? box.max.y : toward.y < 0 ? box.min.y : c.y,
    z: toward.z > 0 ? box.max.z : toward.z < 0 ? box.min.z : c.z,
  }
  const eye = { x: face.x + toward.x * gap, y: face.y + toward.y * gap, z: face.z + toward.z * gap }
  const rail = { x: eye.x - up.x * eyeHeight, y: eye.y - up.y * eyeHeight, z: eye.z - up.z * eyeHeight }
  let closest = Infinity
  for (let i = 0; i <= 16; i++) {
    const f = i / 16
    closest = Math.min(closest, boxDistance(box, { x: rail.x + (eye.x - rail.x) * f, y: rail.y + (eye.y - rail.y) * f, z: rail.z + (eye.z - rail.z) * f }))
  }
  if (closest < clearance) throw new Error(`head-chopper: the car passes ${closest.toFixed(2)} from the solid, under the ${clearance} clearance`)
  return { rail, eye }
}

/** The closest the rider's eye comes to `box` between arc fractions `from` and `to`: the near miss, measured. */
export function eyeClearance(curve: TrackCurve, box: Box, eyeHeight: number, from = 0, to = 1, samples = 2000): number {
  const up = new THREE.Vector3()
  let closest = Infinity
  for (let i = 0; i <= samples; i++) {
    const t = from + ((to - from) * i) / samples
    seatUp(curve, t, up)
    closest = Math.min(closest, boxDistance(box, _p.copy(curve.getPointAt(t)).addScaledVector(up, eyeHeight)))
  }
  return closest
}
