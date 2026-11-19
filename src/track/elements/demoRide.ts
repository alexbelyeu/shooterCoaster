import { createSplineCurve, type SplineTrackCurve } from '../curves/SplineCurve'
import { type Box, headChopper } from './headChopper'
import { RideBuilder, type MarkerKind, type RideMarker } from './rideBuilder'
import { airtimeHill, bankedTurn, corkscrew, heartlineRoll, helix, verticalLoop, zeroGRoll } from './elements'

/** The demo's eye height: a trackScale 1 track's (`getTrackDimensions`). */
export const DEMO_EYE = 6
/** The demo's rail clearance for the head-chopper. */
const DEMO_CLEARANCE = 0.8
const START_Y = 30
const CLIMB = Math.PI / 12

export interface DemoRide {
  curve: SplineTrackCurve
  markers: RideMarker[]
  /** The head-chopper's beam. */
  beam: Box
}

/**
 * One of each element on a closed circuit (#698): out along +z a loop, a zero-g roll and a corkscrew; a banked
 * turn; back an airtime hill, a heartline roll, a head-chopper under a beam and a helix; a climb and a turn home.
 * The dev ride page (`rides.html`) rides it; the elements' tests sample it.
 */
export function buildDemoRide(): DemoRide {
  const b = new RideBuilder({ x: 0, y: START_Y, z: 0, eyeHeight: DEMO_EYE })
  b.mark('straight', () => b.straight(30))
  verticalLoop(b)
  b.mark('straight', () => b.straight(24))
  zeroGRoll(b)
  b.mark('straight', () => b.straight(24))
  corkscrew(b)
  b.mark('straight', () => b.straight(24))
  bankedTurn(b, { angle: Math.PI, radius: 36 })
  b.mark('straight', () => b.straight(20))
  airtimeHill(b)
  b.mark('straight', () => b.straight(16))
  heartlineRoll(b)
  b.mark('straight', () => b.straight(16))

  // The beam is placed over the pass's middle; `headChopper` puts the rails 1 unit of gap under it.
  const pass = 24
  const mid = b.position.addScaledVector(b.forward, pass / 2)
  const bottom = mid.y + DEMO_EYE + 1
  const beam: Box = { min: { x: mid.x - 10, y: bottom, z: mid.z - 1.5 }, max: { x: mid.x + 10, y: bottom + 3, z: mid.z + 1.5 } }
  const { rail } = headChopper(beam, { x: 0, y: -1, z: 0 }, { eyeHeight: DEMO_EYE, clearance: DEMO_CLEARANCE })
  if (Math.abs(rail.y - mid.y) > 1e-6) throw new Error('demo ride: the head-chopper pass is off its beam')
  b.mark('headChopper', () => b.straight(pass))

  b.mark('straight', () => b.straight(16))
  helix(b, { hand: -1 })
  b.mark('straight', () => b.straight(16))

  // Climb back to the start's height, then far enough back for the turn home to land short of the start.
  const lastArc = 30 * (1 - Math.cos(CLIMB))
  b.mark('straight', () => {
    b.pitch(CLIMB, 30)
    b.straight((START_Y - b.position.y - lastArc) / Math.sin(CLIMB))
    b.pitch(-CLIMB, 30)
    const p = b.position
    if (p.z > -40) b.straight(p.z + 40)
  })
  const p = b.position
  bankedTurn(b, { angle: Math.PI, radius: p.x / 2 })
  b.mark('straight', () => b.straight(-b.position.z - b.spacing))
  return { curve: createSplineCurve(b.points), markers: b.markers, beam }
}

/** Arc fraction of the middle of the `index`-th marker of `kind` (wrapping round the seam). */
export function markerT(ride: DemoRide, kind: MarkerKind, at = 0.5, index = 0): number {
  const m = ride.markers.filter((k) => k.kind === kind)[index]
  if (!m) throw new Error(`no ${kind} marker #${index}`)
  const from = ride.curve.knotT(m.from)
  const to = ride.curve.knotT(m.to)
  return from + ((to < from ? to + 1 : to) - from) * at
}
