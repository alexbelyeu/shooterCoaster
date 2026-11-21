import * as THREE from 'three'
import type { RailPoint } from '../curves/SplineCurve'
import { unrolledUp } from '../mechanics'
import { type RideBuilder, type Twist, smoothstep } from './rideBuilder'

/**
 * The ride kit's unmarked pieces (`docs/RIDE-KIT.md`): straights and turns that climb or fall on the way, pitched in and
 * out of their grade, for a ride laid out on a floor plan (level 6's, #757). The elements (`elements.ts`) are built on
 * them; a ride marks them itself. `rise` is upward, `ease` the radius of the pitches into and out of the grade.
 */

/** A bank held through a run: eased in over the first `ease` of it and out over the last. */
export function bankProfile(bank: number, ease = 0.25): Twist {
  return { at: (u) => bank * smoothstep(u / ease) * smoothstep((1 - u) / ease) }
}

/**
 * The grade that climbs `rise` (negative falls) over `length`, pitched in and out of it on `ease`: solves
 * rise = 2·ease·(1 − cos g) + length·tan g for `length` of ground, or (`along: 'track'`) rise = 2·ease·(1 − cos g) +
 * length·sin g for `length` of track.
 */
export function gradeFor(length: number, rise: number, ease: number, along: 'ground' | 'track' = 'ground'): number {
  const pitches = (g: number) => Math.sign(rise) * 2 * ease * (1 - Math.cos(g))
  let g = 0
  for (let i = 0; i < 12; i++) {
    g = along === 'ground' ? Math.atan2(rise - pitches(g), length) : Math.asin(Math.max(-0.95, Math.min(0.95, (rise - pitches(g)) / length)))
  }
  return g
}

/**
 * Straight on over `run` units of ground, climbing `rise` on the way. The pitches cover 2·ease·sin g of the ground and the
 * grade the rest; when even the steepest grade that fits can't climb it, the pitches tighten until one does.
 */
export function climbingStraight(b: RideBuilder, run: number, { rise = 0, ease = 2 * b.eyeHeight } = {}): RideBuilder {
  if (Math.abs(rise) < 1e-6) return b.straight(run)
  const up = Math.abs(rise)
  let e = ease
  const climb = (g: number) => 2 * e * (1 - Math.cos(g)) + ((run - 2 * e * Math.sin(g)) / Math.cos(g)) * Math.sin(g)
  const steepest = () => Math.min(Math.asin(Math.min(run / (2 * e), 1)), 1.4)
  while (climb(steepest()) < up) e *= 0.8
  let lo = 0
  let hi = steepest()
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (climb(mid) < up) lo = mid
    else hi = mid
  }
  const g = Math.sign(rise) * lo
  const middle = Math.max((run - 2 * e * Math.sin(lo)) / Math.cos(lo), 0)
  b.pitch(g, e)
  if (middle > 1e-3) b.straight(middle)
  return b.pitch(-g, e)
}

/** A climbing straight on until the builder is at `value` along world `axis` (it must be heading along that axis). */
export function straightTo(b: RideBuilder, axis: 'x' | 'z', value: number, options: { rise?: number; ease?: number } = {}): RideBuilder {
  return climbingStraight(b, Math.abs(value - b.position[axis]), options)
}

/**
 * A turn of `angle` (positive left) on `radius` units of ground, climbing on the way, rolled by `twist`. The grade is
 * solved for `rise` over angle·radius of track, then the turn widens to radius / cos g to keep the level turn's ground
 * plan, so on a grade it climbs a little more than `rise` (its grade's share by 1 / cos g). Level 6's ride is laid out
 * on this (#757): an exact climb would change it.
 */
export function climbingTurn(
  b: RideBuilder,
  angle: number,
  radius: number,
  { rise = 0, ease = 2 * b.eyeHeight, twist }: { rise?: number; ease?: number; twist?: Twist } = {},
): RideBuilder {
  if (Math.abs(rise) < 1e-6) return b.turn(angle, radius, twist)
  const g = gradeFor(Math.abs(angle) * radius, rise, ease, 'track')
  b.pitch(g, ease)
  b.turn(angle, radius / Math.cos(g), twist)
  return b.pitch(-g, ease)
}

const UNROLLED_COS = Math.cos((0.5 * Math.PI) / 180)
const _tangent = new THREE.Vector3()
const _unrolled = new THREE.Vector3()

/** Drops the ups a spline would work out anyway (within 0.5° of unrolled, the track not steep), keeping a ride's data small. */
export function trimUnrolledUps(points: readonly RailPoint[]): RailPoint[] {
  const n = points.length
  return points.map((p, i) => {
    if (!p.up) return p
    const a = points[(i - 1 + n) % n]
    const c = points[(i + 1) % n]
    _tangent.set(c.x - a.x, c.y - a.y, c.z - a.z).normalize()
    if (Math.abs(_tangent.y) > 0.85) return p
    unrolledUp(_tangent, _unrolled)
    const cos = (_unrolled.x * p.up.x + _unrolled.y * p.up.y + _unrolled.z * p.up.z) / Math.hypot(p.up.x, p.up.y, p.up.z)
    return cos > UNROLLED_COS ? { x: p.x, y: p.y, z: p.z } : p
  })
}
