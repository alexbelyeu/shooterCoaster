import type { RideMechanic } from '@/types/level'
import type { SplineTrackCurve } from '../curves/SplineCurve'
import { RIDE_V2_DEFAULTS } from '../rideV2'
import type { RideBuilder } from './rideBuilder'

/** The special mechanics' track (#699); each returns its mechanic by control point index, for `placeMechanics`. */

/** The default stop at a drop track's top and a turntable, seconds. */
const STOP_SECONDS = 1.5

function span(b: RideBuilder, kind: RideMechanic['kind'] | 'jumpBooster'): { from: number; to: number } {
  const m = b.markers[b.markers.length - 1]
  if (m?.kind !== kind) throw new Error(`${kind}: its marker is missing`)
  return { from: m.from, to: m.to }
}

/** The station the ride starts in, its fins `length` long: the builder's first element. */
export function station(b: RideBuilder, { speed, length = 20 * b.eyeHeight }: { speed: number; length?: number }): RideMechanic {
  if (b.points.length !== 1) throw new Error('station: the ride starts in it, so it comes first')
  b.mark('station', () => b.straight(length))
  return { kind: 'station', ...span(b, 'station'), speed }
}

/** A drop track `height` straight down, leaving on the heading it came in on (its bends of `radius` hide in the shaft). */
export function dropTrack(
  b: RideBuilder,
  { height, radius = 0.75 * b.eyeHeight, seconds = STOP_SECONDS }: { height: number; radius?: number; seconds?: number },
): RideMechanic {
  if (!(height > 2 * radius)) throw new Error('dropTrack: taller than its two bends')
  b.mark('dropTrack', () => {
    b.pitch(-Math.PI / 2, radius)
    b.straight(height - 2 * radius)
    b.pitch(Math.PI / 2, radius)
  })
  return { kind: 'dropTrack', ...span(b, 'dropTrack'), seconds }
}

/**
 * The radius (units travelled per radian) of a ballistic flight's path where it heads `phi` above level, launched at
 * `speed` and `angle` under `gravity`: the level speed holds (v cos φ = speed cos angle), so R = v² / (g cos φ).
 */
export function flightRadius(speed: number, angle: number, gravity: number, phi: number): number {
  const level = speed * Math.cos(angle)
  return (level * level) / (gravity * Math.cos(phi) ** 3)
}

/** A jump gap: booster, ramp up to `angle`, a ballistic flight at `speed` under the ride's `gravity`, a landing at the lip's height. */
export function jumpGap(
  b: RideBuilder,
  {
    speed,
    angle = Math.PI / 7,
    gravity = RIDE_V2_DEFAULTS.gravity,
    booster = 8 * b.eyeHeight,
    ramp = 3 * b.eyeHeight,
  }: { speed: number; angle?: number; gravity?: number; booster?: number; ramp?: number },
): RideMechanic {
  b.mark('jumpBooster', () => {
    b.straight(booster)
    b.pitch(angle, ramp)
  })
  const boostFrom = span(b, 'jumpBooster').from
  b.mark('jumpGap', () => b.pitch(-2 * angle, (u) => flightRadius(speed, angle, gravity, angle * (1 - 2 * u))))
  const flight = span(b, 'jumpGap')
  b.mark('straight', () => b.pitch(angle, ramp))
  return { kind: 'jumpGap', ...flight, speed, boostFrom }
}

/** `build`'s track ridden backwards between two turntables, which want straight track either side. */
export function backwards(b: RideBuilder, build: () => void, { speed, seconds = STOP_SECONDS }: { speed: number; seconds?: number }): RideMechanic {
  b.mark('backwards', build)
  return { kind: 'backwards', ...span(b, 'backwards'), seconds, speed }
}

/** The mechanics on the built curve: control point indices to the track's arc shares. */
export function placeMechanics(curve: SplineTrackCurve, mechanics: readonly RideMechanic[]): RideMechanic[] {
  return mechanics.map((m) => {
    const placed = { ...m, from: curve.knotT(m.from), to: curve.knotT(m.to) }
    return placed.kind === 'jumpGap' ? { ...placed, boostFrom: curve.knotT(placed.boostFrom) } : placed
  })
}
