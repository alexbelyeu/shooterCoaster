/** The title park's coaster (#419): the train's place is a pure function of time, so the camera can frame it and the posters hold it. */

import * as THREE from 'three'
import type { TrackCurve } from '@/track/curves/TrackCurve'
import { buildArcTable, tAtLoopDistance, type ArcTable } from '@/track/arcLength'
import type { Vec3 } from './titleCamera'

/** Loop radius: outside the tents (r 120, 18 wide) and inside the orbit camera (r 180). */
export const TRACK_RADIUS = 152
const RADIUS_WOBBLE = 6
const BASE_HEIGHT = 27
/** Rides at track scale 1.6 (`getTrackDimensions`), so the cars read at the park's scale (36-unit tents). */
export const TITLE_TRACK_SCALAR = 51.2

/** Train speed (units/s): v = sqrt(v0² + 2g (top − y)), so the crests are slow and the dips fast. */
const CREST_SPEED = 18
const GRAVITY = 12
export const CARS = 4
/** Arc distance between car centres. */
export const CAR_SPACING = 10
/** The lead car starts on the far side of the orbit camera's first view (t = 0 looks from +x), coming round. */
const START_ANGLE = 2.3

const TIME_SAMPLES = 2048

function trackPoint(t: number, out: THREE.Vector3): THREE.Vector3 {
  const a = t * Math.PI * 2
  const r = TRACK_RADIUS + RADIUS_WOBBLE * Math.sin(3 * a + 0.4)
  const y = BASE_HEIGHT + 12 * Math.sin(2 * a + 0.6) + 6 * Math.sin(5 * a + 1)
  return out.set(Math.cos(a) * r, y, Math.sin(a) * r)
}

function createTitleCurve(): TrackCurve {
  const point = new THREE.Vector3()
  const tangent = new THREE.Vector3()
  const p1 = new THREE.Vector3()
  const p2 = new THREE.Vector3()
  return {
    getPointAt: (t) => trackPoint(t, point),
    getTangentAt: (t) => {
      const d = 1e-4
      trackPoint(t + d, p2)
      trackPoint(t - d, p1)
      return tangent.copy(p2).sub(p1).normalize()
    },
  }
}

export interface TitleRide {
  curve: TrackCurve
  table: ArcTable
  /** Seconds per lap. */
  lapS: number
  /** Arc distance of the lead car at `time` seconds since the title appeared. */
  leadDistance(time: number): number
  /** Track centreline point at arc distance `dist` (any distance: wraps). */
  pointAt(dist: number, out: Vec3): Vec3
}

export function trainSpeed(y: number, crestY: number): number {
  return Math.sqrt(CREST_SPEED * CREST_SPEED + 2 * GRAVITY * Math.max(0, crestY - y))
}

export function createTitleRide(): TitleRide {
  const curve = createTitleCurve()
  const table = buildArcTable(curve, 4096)
  let crestY = -Infinity
  for (let i = 0; i < table.count; i++) crestY = Math.max(crestY, table.y[i])

  const ds = table.length / TIME_SAMPLES
  const times = new Float64Array(TIME_SAMPLES + 1)
  const p = new THREE.Vector3()
  for (let i = 1; i <= TIME_SAMPLES; i++) {
    const t = tAtLoopDistance(table, (i - 0.5) * ds)
    times[i] = times[i - 1] + ds / trainSpeed(curve.getPointAt(t).y, crestY)
  }
  const lapS = times[TIME_SAMPLES]
  const startDist = (START_ANGLE / (Math.PI * 2)) * table.length

  function lapDistance(time: number): number {
    const lt = ((time % lapS) + lapS) % lapS
    let lo = 0
    let hi = TIME_SAMPLES
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (times[mid] <= lt) lo = mid
      else hi = mid
    }
    const f = (lt - times[lo]) / (times[hi] - times[lo])
    return (lo + f) * ds
  }

  return {
    curve,
    table,
    lapS,
    leadDistance: (time) => startDist + lapDistance(time) + Math.floor(time / lapS) * table.length,
    pointAt: (dist, out) => {
      trackPoint(tAtLoopDistance(table, dist), p)
      out[0] = p.x
      out[1] = p.y
      out[2] = p.z
      return out
    },
  }
}
