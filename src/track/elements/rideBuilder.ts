import * as THREE from 'three'
import type { Point3, RailPoint } from '../curves/SplineCurve'

/** The ride elements (`docs/RIDE-KIT.md`, #698). */
export type ElementKind =
  | 'straight'
  | 'verticalLoop'
  | 'zeroGRoll'
  | 'corkscrew'
  | 'heartlineRoll'
  | 'airtimeHill'
  | 'helix'
  | 'bankedTurn'
  | 'headChopper'
  | 'liftHill'
  // The special mechanics (#699, `mechanics.ts`); a jump's booster is its run-up and ramp to the lip.
  | 'station'
  | 'jumpBooster'
  | 'jumpGap'
  | 'dropTrack'
  | 'backwards'

/** An element's span, or a moment inside one (`slowMotion`: an airtime crest's window for shots). */
export type MarkerKind = ElementKind | 'slowMotion'

/** `from` / `to`: the control points it spans (indices into `RideBuilder.points`, inclusive). */
export interface RideMarker {
  kind: MarkerKind
  from: number
  to: number
}

/**
 * A roll of the rails about the track on top of the frame's own (a bank, a heartline roll): `at(u)` is the angle
 * over the run's u in [0, 1], positive leaning left. `heartline` is the height above the rails it turns about:
 * the rider's heart rides the frame's path at that height while the rails swing round it.
 */
export interface Twist {
  at: (u: number) => number
  heartline?: number
}

/** Radius as a constant or over the run's u in [0, 1]. */
export type Radius = number | ((u: number) => number)

export const TAU = Math.PI * 2
/** Integration steps per control point. */
const SUBSTEPS = 16
/** An element's last point is emitted when at least this share of `spacing` has run since the previous one. */
const TAIL_SHARE = 0.4
/** A twist drops a point at least this often, so the splined up never has to swing far between two. */
const MAX_TWIST_PER_POINT = (20 * Math.PI) / 180

const Y = new THREE.Vector3(0, 1, 0)
const Z = new THREE.Vector3(0, 0, 1)

/** 0 → 1 with zero slope at both ends. */
export function smoothstep(u: number): number {
  const x = Math.min(1, Math.max(0, u))
  return x * x * (3 - 2 * x)
}

/**
 * A turtle that drives a frame through the elements and drops control points with their up (`RailPoint`) every
 * `spacing` units, for `createSplineCurve`. The frame is local +Z forward, +Y up, +X left (the rider's left; it is
 * `trackFrame`'s `right`). Every move is a rotation about an axis fixed in the frame (so a whole turn of one
 * returns the frame exactly to where it started: a loop or a corkscrew exits upright on its entry heading) and an
 * optional twist on top. Pure, cold: tracks are built once per level.
 */
export class RideBuilder {
  readonly points: RailPoint[] = []
  readonly markers: RideMarker[] = []
  readonly eyeHeight: number
  readonly spacing: number
  private readonly pos = new THREE.Vector3()
  private readonly q = new THREE.Quaternion()
  private twist = 0
  private heartline = 0
  private sinceEmit = 0
  private emittedTwist = 0
  private readonly step = new THREE.Quaternion()
  private readonly axis = new THREE.Vector3()
  private readonly fwd = new THREE.Vector3()

  constructor(start: Point3 & { heading?: number; eyeHeight: number; spacing?: number }) {
    this.eyeHeight = start.eyeHeight
    this.spacing = start.spacing ?? start.eyeHeight / 2
    this.pos.set(start.x, start.y, start.z)
    this.q.setFromAxisAngle(Y, start.heading ?? 0)
    this.emit()
  }

  /** Where the frame is: the rails when untwisted. */
  get position(): THREE.Vector3 {
    return this.pos.clone()
  }

  get forward(): THREE.Vector3 {
    return Z.clone().applyQuaternion(this.q)
  }

  /** The frame's up, without the twist. */
  get up(): THREE.Vector3 {
    return Y.clone().applyQuaternion(this.q)
  }

  /** Runs `build` and marks the control points it emitted as `kind`. */
  mark(kind: MarkerKind, build: () => void): this {
    const from = this.points.length - 1
    build()
    if (this.sinceEmit > TAIL_SHARE * this.spacing) this.emit()
    this.markers.push({ kind, from, to: this.points.length - 1 })
    return this
  }

  straight(length: number, twist?: Twist): this {
    return this.run(Math.max(1, Math.ceil((length / this.spacing) * SUBSTEPS)), () => length, 0, twist)
  }

  /** Nose up (`angle` > 0) or down, `radius` units travelled per radian. */
  pitch(angle: number, radius: Radius, twist?: Twist): this {
    return this.arc(angle, this.axis.set(-1, 0, 0), radius, twist)
  }

  /** About world up, positive to the left, `radius` units travelled per radian. */
  turn(angle: number, radius: Radius, twist?: Twist): this {
    return this.arc(angle, this.axis.copy(Y).applyQuaternion(this.q.clone().invert()), radius, twist)
  }

  /** Turns the frame `angle` about `axis` (in its own coordinates as the arc starts), `radius` units travelled per radian. */
  arc(angle: number, axis: THREE.Vector3, radius: Radius, twist?: Twist): this {
    const r = typeof radius === 'number' ? () => radius : radius
    let length = 0
    for (let i = 0; i < 64; i++) length += (r((i + 0.5) / 64) * Math.abs(angle)) / 64
    const steps = Math.max(1, Math.ceil((length / this.spacing) * SUBSTEPS))
    const a = axis.clone().normalize()
    return this.run(steps, (u) => r(u) * Math.abs(angle), angle, twist, a)
  }

  private run(steps: number, lengthAt: (u: number) => number, angle: number, twist?: Twist, axis?: THREE.Vector3): this {
    for (let k = 0; k < steps; k++) {
      const u = (k + 0.5) / steps
      const ds = lengthAt(u) / steps
      this.fwd.copy(Z).applyQuaternion(this.q)
      this.pos.addScaledVector(this.fwd, ds / 2)
      if (axis) this.q.multiply(this.step.setFromAxisAngle(axis, angle / steps)).normalize()
      this.fwd.copy(Z).applyQuaternion(this.q)
      this.pos.addScaledVector(this.fwd, ds / 2)
      if (twist) {
        this.twist = twist.at((k + 1) / steps)
        this.heartline = twist.heartline ?? 0
      }
      this.sinceEmit += ds
      if (this.sinceEmit >= this.spacing || Math.abs(this.twist - this.emittedTwist) >= MAX_TWIST_PER_POINT) this.emit()
    }
    // A whole roll is no roll: the next element starts from an untwisted frame.
    if (Math.abs(this.twist) > 1e-9 && Math.abs(this.twist / TAU - Math.round(this.twist / TAU)) < 1e-9) {
      this.emittedTwist -= this.twist
      this.twist = 0
    }
    if (this.twist === 0) this.heartline = 0
    return this
  }

  private emit(): void {
    const twisted = this.q.clone().multiply(this.step.setFromAxisAngle(Z, -this.twist))
    const up = Y.clone().applyQuaternion(twisted)
    const rail = this.pos.clone()
    if (this.heartline > 0) rail.addScaledVector(Y.clone().applyQuaternion(this.q), this.heartline).addScaledVector(up, -this.heartline)
    this.points.push({ x: rail.x, y: rail.y, z: rail.z, up: { x: up.x, y: up.y, z: up.z } })
    this.sinceEmit = 0
    this.emittedTwist = this.twist
  }
}
