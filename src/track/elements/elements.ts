import * as THREE from 'three'
import { type RideBuilder, TAU, smoothstep } from './rideBuilder'

/**
 * The classic coaster elements (`docs/RIDE-KIT.md`, #698), each appended to a `RideBuilder` and marked with its
 * span. Sizes default to multiples of the builder's eye height, so they scale with the track. `hand` 1 rolls or
 * turns left, -1 right.
 */
type Hand = 1 | -1

/** Where a heartline roll turns: the rider's chest, a bit under the eye. */
const HEART_SHARE = 0.6

/** A whole roll, eased in and out. */
const fullRoll = (hand: Hand, heartline: number) => ({ at: (u: number) => hand * TAU * smoothstep(u), heartline })

/** A bank held through a run: eased in over the first `ease` of it and out over the last. */
function bankProfile(bank: number, ease = 0.25) {
  return { at: (u: number) => bank * smoothstep(u / ease) * smoothstep((1 - u) / ease) }
}

/**
 * A vertical loop: one whole turn nose-up, a teardrop (`teardrop` tighter at the top than the bottom), exiting
 * upright on its entry heading `offset` to the side so the exit clears the entry. The rider is upside down at the apex.
 */
export function verticalLoop(b: RideBuilder, { radius = 3.5 * b.eyeHeight, offset = 1.2 * b.eyeHeight, teardrop = 0.3 } = {}): RideBuilder {
  return b.mark('verticalLoop', () => screw(b, radius, offset / TAU, Math.sign(offset) as Hand, teardrop))
}

/**
 * A corkscrew: the rails wind once round a helix `radius` from its axis (the rider inside, head toward it),
 * advancing `length` along it; exits upright on its entry heading, shifted to the `hand` side.
 */
export function corkscrew(b: RideBuilder, { radius = 0.8 * b.eyeHeight, length = 7 * b.eyeHeight, hand = 1 as Hand } = {}): RideBuilder {
  return b.mark('corkscrew', () => screw(b, radius, length / TAU, hand, 0))
}

/**
 * One whole turn of the frame about an axis fixed in it: a helix of radius `r` and `c` units of advance per radian
 * round its axis (curvature r / (r² + c²), torsion c / (r² + c²)). `teardrop` shortens the travel per radian at the
 * half-turn and lengthens it at the ends.
 */
function screw(b: RideBuilder, r: number, c: number, hand: Hand, teardrop: number): void {
  const k = r * r + c * c
  const axis = new THREE.Vector3(-r / k, 0, (-hand * Math.abs(c)) / k)
  const perRadian = Math.sqrt(k)
  b.arc(TAU, axis, (u) => perRadian * (1 + teardrop * Math.cos(TAU * u)))
}

/**
 * A zero-g roll: over a crest the rails roll once round the rider's heart, so they float through it upside down.
 * `length` is the crest's, `angle` the climb into it.
 */
export function zeroGRoll(b: RideBuilder, { length = 6 * b.eyeHeight, angle = Math.PI / 7, hand = 1 as Hand } = {}): RideBuilder {
  const radius = length / (2 * angle)
  return b.mark('zeroGRoll', () => {
    b.pitch(angle, radius)
    b.pitch(-2 * angle, radius, fullRoll(hand, HEART_SHARE * b.eyeHeight))
    b.pitch(angle, radius)
  })
}

/** A heartline roll: straight and level, the rails rolling once round the rider's heart. */
export function heartlineRoll(b: RideBuilder, { length = 5 * b.eyeHeight, hand = 1 as Hand } = {}): RideBuilder {
  return b.mark('heartlineRoll', () => b.straight(length, fullRoll(hand, HEART_SHARE * b.eyeHeight)))
}

/**
 * An airtime hill: up `rise` over a crest of `crestRadius` and back down to the same height. The middle of the crest
 * is marked `slowMotion`: the floating moment for a short slow-motion window and a cluster of targets.
 */
export function airtimeHill(
  b: RideBuilder,
  { rise = 2 * b.eyeHeight, crestRadius = 4 * b.eyeHeight, angle = (35 * Math.PI) / 180 } = {},
): RideBuilder {
  const valley = Math.max(b.eyeHeight, rise / (1 - Math.cos(angle)) - crestRadius)
  return b.mark('airtimeHill', () => {
    b.pitch(angle, valley)
    b.pitch(-angle * 0.6, crestRadius)
    b.mark('slowMotion', () => b.pitch(-angle * 0.8, crestRadius))
    b.pitch(-angle * 0.6, crestRadius)
    b.pitch(angle, valley)
  })
}

/**
 * A helix: `turns` whole turns of `radius` (horizontal), banked into them, falling `drop` over the lot. Each turn
 * passes `drop / turns` under the last, so that must clear the car.
 */
export function helix(
  b: RideBuilder,
  { radius = 4 * b.eyeHeight, turns = 1, drop = 2 * b.eyeHeight, bank = (40 * Math.PI) / 180, hand = 1 as Hand } = {},
): RideBuilder {
  const entry = b.eyeHeight * 2
  // The pitch into and out of the grade falls too: take it off the turns' share.
  let grade = 0
  for (let i = 0; i < 8; i++) grade = Math.atan2(drop - 2 * entry * (1 - Math.cos(grade)), TAU * radius * turns)
  return b.mark('helix', () => {
    b.pitch(-grade, entry)
    b.turn(hand * TAU * turns, radius / Math.cos(grade), bankProfile(hand * bank, 0.15 / turns))
    b.pitch(grade, entry)
  })
}

/** A level turn of `angle` (positive left) on `radius`, banked into it. */
export function bankedTurn(b: RideBuilder, { angle = Math.PI / 2, radius = 4 * b.eyeHeight, bank = (35 * Math.PI) / 180 } = {}): RideBuilder {
  return b.mark('bankedTurn', () => b.turn(angle, radius, bankProfile(Math.sign(angle) * bank)))
}
