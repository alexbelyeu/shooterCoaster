/**
 * Ride comfort (#761): how fast the rider's view turns, from the track alone. Alex rode level 6's rebuilt ride on
 * 20 Nov and found it dizzying: its view turned at 100–270°/s for whole seconds and snapped at up to 900°/s in a
 * tenth of a second, in a hall too small for its speed. Levels 1–5 never pass 105°/s over 2 s.
 *
 * The rider's frame is the seat's (tangent forward, the track's up; upright facing the drop's heading on a drop track, as
 * `seatPose` rides it), sampled every 0.1 s of ride time from GO. The camera adds a little smoothing on top, so these
 * figures are what the ride asks of the eye, at most.
 */
import * as THREE from 'three'
import type { TrackParams } from '@/types/level'
import { createTrackCurve } from './curves/createTrackCurve'
import { buildArcTable, distanceAtT, tAtLoopDistance } from './arcLength'
import { dropHeading, droppingOn } from './mechanics.hot'
import { rideModel, rideProfile } from './ridePhysics'
import { seatUp } from './trackGeometry'

/** The gate every level's ride passes (`rideComfort.test.ts`), set from levels 1–5 with a little room. */
export const COMFORT = {
  /** No 2 s stretch whose view turns faster than this on average (°/s). Levels 1–5: 70–105. */
  twoSecondMax: 110,
  /** At most this many whole seconds of the run over `fastSecond`. Levels 1–5: 1–4. */
  fastSeconds: 4,
  fastSecond: 90,
  /** No 0.1 s step faster than this (°/s): a snap. Levels 1–5: 153–316. */
  snapMax: 350,
} as const

export interface RideComfort {
  /** The view's rotation rate over each 0.1 s step, °/s. */
  steps: number[]
  /** The average rate over each whole second. */
  seconds: number[]
  twoSecondMax: number
  fastSeconds: number
  snapMax: number
  /** Where the worst 2 s, and the worst snap, start (seconds after GO). */
  twoSecondAt: number
  snapAt: number
}

const DEG = 180 / Math.PI

export function rideComfort(track: TrackParams, seconds: number): RideComfort {
  const curve = createTrackCurve(track)
  const table = buildArcTable(curve)
  const profile = rideProfile(table, rideModel(track, table), seconds + 1)
  const tan = new THREE.Vector3()
  const up = new THREE.Vector3()
  const right = new THREE.Vector3()
  const basis = new THREE.Matrix4()
  const frame = (k: number, out: THREE.Quaternion) => {
    const t = tAtLoopDistance(table, profile[k])
    const drop = track.mechanics ? droppingOn(track.mechanics, distanceAtT(table, t), table.length) : null
    if (drop) {
      dropHeading(curve, drop, tan)
      up.set(0, 1, 0)
    } else {
      tan.copy(curve.getTangentAt(t)).normalize()
      seatUp(curve, t, up)
    }
    right.crossVectors(tan, up).normalize()
    up.crossVectors(right, tan).normalize()
    return out.setFromRotationMatrix(basis.makeBasis(right, up, tan.negate()))
  }
  const steps: number[] = []
  let prev = frame(0, new THREE.Quaternion())
  const cur = new THREE.Quaternion()
  const n = Math.min(profile.length - 1, Math.round(seconds * 10))
  for (let k = 1; k <= n; k++) {
    frame(k, cur)
    steps.push(2 * Math.acos(Math.min(1, Math.abs(prev.dot(cur)))) * DEG * 10)
    prev = cur.clone()
  }
  const perSecond = Array.from({ length: Math.floor(steps.length / 10) }, (_, s) => steps.slice(s * 10, s * 10 + 10).reduce((a, b) => a + b, 0) / 10)
  let twoSecondMax = 0
  let twoSecondAt = 0
  for (let k = 0; k + 20 <= steps.length; k++) {
    const avg = steps.slice(k, k + 20).reduce((a, b) => a + b, 0) / 20
    if (avg > twoSecondMax) { twoSecondMax = avg; twoSecondAt = k / 10 }
  }
  const snapMax = Math.max(0, ...steps)
  return {
    steps,
    seconds: perSecond,
    twoSecondMax,
    fastSeconds: perSecond.filter((x) => x > COMFORT.fastSecond).length,
    snapMax,
    twoSecondAt,
    snapAt: steps.indexOf(snapMax) / 10,
  }
}

/** What's over the gate, in words, or nothing. */
export function comfortProblems(c: RideComfort): string[] {
  const out: string[] = []
  if (c.twoSecondMax > COMFORT.twoSecondMax) out.push(`the view turns ${Math.round(c.twoSecondMax)}°/s over 2 s from ${c.twoSecondAt.toFixed(1)} s (max ${COMFORT.twoSecondMax})`)
  if (c.fastSeconds > COMFORT.fastSeconds) out.push(`${c.fastSeconds} s of the run over ${COMFORT.fastSecond}°/s (max ${COMFORT.fastSeconds})`)
  if (c.snapMax > COMFORT.snapMax) out.push(`a ${Math.round(c.snapMax)}°/s snap at ${c.snapAt.toFixed(1)} s (max ${COMFORT.snapMax})`)
  return out
}
