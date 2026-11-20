import type { RideMechanic, RideV2Spec } from '@/types/level'
import { createSplineCurve, type SplineTrackCurve } from '../curves/SplineCurve'
import { STOP_APPROACH } from '../mechanics'
import { RideBuilder, type RideMarker } from './rideBuilder'
import { bankedTurn } from './elements'
import { DEMO_EYE } from './demoRide'
import { backwards, dropTrack, jumpGap, placeMechanics, station } from './mechanicElements'

const START_Y = 70
const DROP = 40
const CLIMB = Math.PI / 12
const LIFT_SPEED = 40
/** Where the run-up to a stop starts: its brake run plus some straight to see it coming. */
const RUN_UP = STOP_APPROACH + 2 * DEMO_EYE

export const MECHANICS_SPEEDS = { launch: 130, jump: 120, backwards: 60 } as const

export interface MechanicsRide {
  curve: SplineTrackCurve
  markers: RideMarker[]
  mechanics: RideMechanic[]
  /** A chain up the climb home; the mechanics add their own zones and stops. */
  spec: RideV2Spec
}

/** One of each special mechanic (#699) on a closed v2 circuit, for `rides.html` and `mechanics.test.ts`. */
export function buildMechanicsRide(): MechanicsRide {
  const b = new RideBuilder({ x: 0, y: START_Y, z: 0, eyeHeight: DEMO_EYE })
  const placed: RideMechanic[] = []
  placed.push(station(b, { speed: MECHANICS_SPEEDS.launch }))
  b.mark('straight', () => b.straight(20))
  placed.push(jumpGap(b, { speed: MECHANICS_SPEEDS.jump }))
  b.mark('straight', () => b.straight(RUN_UP))
  placed.push(dropTrack(b, { height: DROP }))
  b.mark('straight', () => b.straight(40))
  bankedTurn(b, { angle: Math.PI, radius: 40 })
  b.mark('straight', () => b.straight(RUN_UP))
  placed.push(backwards(b, () => b.straight(260), { speed: MECHANICS_SPEEDS.backwards }))
  b.mark('straight', () => b.straight(30))

  // A chain back up to the station's height, then far enough on for the turn home to land short of the start.
  const lastArc = 30 * (1 - Math.cos(CLIMB))
  b.mark('liftHill', () => {
    b.pitch(CLIMB, 30)
    b.straight((START_Y - b.position.y - lastArc) / Math.sin(CLIMB))
    b.pitch(-CLIMB, 30)
  })
  const lift = b.markers[b.markers.length - 1]
  const p = b.position
  if (p.z > -40) b.mark('straight', () => b.straight(p.z + 40))
  bankedTurn(b, { angle: Math.PI, radius: b.position.x / 2 })
  b.mark('straight', () => b.straight(-b.position.z - b.spacing))

  const curve = createSplineCurve(b.points)
  const spec: RideV2Spec = { zones: [{ kind: 'lift', from: curve.knotT(lift.from), to: curve.knotT(lift.to), speed: LIFT_SPEED }] }
  return { curve, markers: b.markers, mechanics: placeMechanics(curve, placed), spec }
}
