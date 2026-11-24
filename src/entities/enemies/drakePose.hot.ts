import * as THREE from 'three'
import { DRAKE_ELBOW, DRAKE_JAW_HINGE, DRAKE_NECK_ROOT, DRAKE_PART, DRAKE_SHOULDER, DRAKE_TAIL_ROOT } from './infernoEnemyAssets'

/** A drake's joints (radians): the neck's pitch and yaw, the jaw's drop, the tail's lift and swing, and both wings' arm and hand. */
export interface DrakePose {
  neckX: number
  neckY: number
  jaw: number
  tailX: number
  tailY: number
  arm: number
  hand: number
}

/** Shot, it roars: head reared back, jaw open, tail up, wings thrown up (its hit flash holds it, `DRAKE_ROAR_MAT`). */
export const DRAKE_ROAR: DrakePose = { neckX: -0.55, neckY: 0, jaw: 0.75, tailX: 0.4, tailY: 0, arm: 0.9, hand: 0.6 }

const NECK = new THREE.Vector3(...DRAKE_NECK_ROOT)
const JAW = new THREE.Vector3(...DRAKE_JAW_HINGE).add(NECK)
const TAIL = new THREE.Vector3(...DRAKE_TAIL_ROOT)
const SHOULDER = new THREE.Vector3(...DRAKE_SHOULDER)
const ELBOW = new THREE.Vector3(...DRAKE_ELBOW).add(SHOULDER)
const MIRROR = new THREE.Matrix4().makeScale(-1, 1, 1)
const _euler = new THREE.Euler()
const _p = new THREE.Vector3()
const _m = new THREE.Matrix4()

/** `out` = the rotation (x, y, z) about `at`, in the model frame. */
function turnAbout(out: THREE.Matrix4, at: THREE.Vector3, x: number, y: number, z: number): THREE.Matrix4 {
  out.makeRotationFromEuler(_euler.set(x, y, z))
  _p.copy(at).applyMatrix4(out)
  return out.setPosition(at.x - _p.x, at.y - _p.y, at.z - _p.z)
}

/**
 * Each part's matrix from its place at rest in `DRAKE_GEO` to `pose`, indexed by `DRAKE_PART`: the jaw hangs off the
 * neck and each hand off its arm; the left wing is mirrored (the right one's matrix between two mirrors).
 */
export function poseDrake(out: THREE.Matrix4[], pose: DrakePose): void {
  const P = DRAKE_PART
  out[P.body].identity()
  turnAbout(out[P.neck], NECK, pose.neckX, pose.neckY, 0)
  out[P.jaw].multiplyMatrices(out[P.neck], turnAbout(_m, JAW, pose.jaw, 0, 0))
  turnAbout(out[P.tail], TAIL, pose.tailX, pose.tailY, 0)
  turnAbout(out[P.rightArm], SHOULDER, 0, 0, pose.arm)
  out[P.rightHand].multiplyMatrices(out[P.rightArm], turnAbout(_m, ELBOW, 0, 0, pose.hand))
  out[P.leftArm].multiplyMatrices(MIRROR, out[P.rightArm]).multiply(MIRROR)
  out[P.leftHand].multiplyMatrices(MIRROR, out[P.rightHand]).multiply(MIRROR)
}
