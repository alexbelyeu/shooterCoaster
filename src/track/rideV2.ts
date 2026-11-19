import type { ArcTable } from './arcLength'
import type { RideBeat, RideV2Spec, SpeedZone } from '@/types/level'

/**
 * The v2 ride (#696), pure: real speed (gravity with drag, a crawl floor, launches, lift hills and brakes) solved ahead
 * of time so the storyboard's beats land on their seconds. The result is a plan, distance and speed at every 60 fps
 * frame from GO: the live ride reads it by ride time (`ridePhysics.ts` `advanceRide`), so it is the same ride at any
 * frame rate and spawning predicts it exactly (`rideProfile`).
 *
 * The solver's one knob per stretch between two beats is a scale `a`: speeds × a and accelerations (gravity, a zone's)
 * × a². Drag per speed² is unchanged, so from rest that is the same ride exactly 1 / a times as long: slow crests and
 * fast drops keep their shape.
 */

/** Gravity near 9.8 m/s² at the gym's 32 world units per metre; drag a mild cap on the fastest drops. */
export const RIDE_V2_DEFAULTS = { gravity: 300, drag: 0.0005, crawl: 12 } as const
/** A solved beat lands within this many seconds of its second. */
export const BEAT_TOLERANCE_SECONDS = 0.5
/** The plan's samples per second, one per 60 fps frame. */
export const PLAN_RATE = 60
/** Seconds the plan simulates; past it the car holds its last speed. */
const HORIZON_SECONDS = 240
/** Even arc-length cells the slope and zones are looked up in. */
const CELLS = 4096
/** The solver's range for a stretch's scale. */
const MIN_SCALE = 1 / 16
const MAX_SCALE = 16
const SOLVER_STEPS = 40

export interface RidePlan {
  table: ArcTable
  /** Arc distance ridden (not wrapped) and speed (world units per second) at frame k, `k / PLAN_RATE` s after GO. */
  distance: Float64Array
  speed: Float64Array
  /** The slowest (after the standing start) and fastest speeds it rides. */
  minSpeed: number
  maxSpeed: number
  /** The solved scale of each stretch: up to the first beat, between beats, after the last. */
  scales: number[]
  /** The second each beat lands. */
  landed: number[]
}

interface Course {
  length: number
  cell: number
  /** Rise per unit of arc in each cell. */
  slope: Float64Array
  /** The zone over each cell, -1 for none. */
  zone: Int16Array
  zones: readonly SpeedZone[]
  gravity: number
  drag: number
  crawl: number
}

interface Car {
  time: number
  distance: number
  speed: number
}

function inZone(zone: SpeedZone, f: number): boolean {
  return zone.from <= zone.to ? f >= zone.from && f < zone.to : f >= zone.from || f < zone.to
}

function buildCourse(table: ArcTable, spec: RideV2Spec): Course {
  const { s, y, count } = table
  const cell = table.length / CELLS
  const height = new Float64Array(CELLS + 1)
  let j = 0
  for (let i = 0; i <= CELLS; i++) {
    const d = i * cell
    while (j < count - 2 && s[j + 1] < d) j++
    const span = s[j + 1] - s[j]
    height[i] = y[j] + (y[j + 1] - y[j]) * (span > 0 ? Math.min(Math.max((d - s[j]) / span, 0), 1) : 0)
  }
  const zones = spec.zones ?? []
  const slope = new Float64Array(CELLS)
  const zone = new Int16Array(CELLS)
  for (let i = 0; i < CELLS; i++) {
    slope[i] = (height[i + 1] - height[i]) / cell
    zone[i] = zones.findIndex((z) => inZone(z, (i + 0.5) / CELLS))
  }
  return {
    length: table.length,
    cell,
    slope,
    zone,
    zones,
    gravity: spec.gravity ?? RIDE_V2_DEFAULTS.gravity,
    drag: spec.drag ?? RIDE_V2_DEFAULTS.drag,
    crawl: spec.crawl ?? RIDE_V2_DEFAULTS.crawl,
  }
}

/** One 60 fps frame of the ride at scale `a`. */
function step(course: Course, car: Car, a: number): void {
  const dt = 1 / PLAN_RATE
  const wrapped = car.distance % course.length
  const i = Math.min(Math.floor(wrapped / course.cell), CELLS - 1)
  const a2 = a * a
  let v = car.speed + (-course.gravity * a2 * course.slope[i] - course.drag * car.speed * car.speed) * dt
  const z = course.zone[i]
  if (z >= 0) {
    const zone = course.zones[z]
    const target = zone.speed * a
    if (zone.kind === 'lift') v = Math.max(v, target)
    else if (zone.kind === 'launch' && v < target) v = Math.min(v + (zone.accel ?? zone.speed / 2) * a2 * dt, target)
    else if (zone.kind === 'brake' && v > target) v = Math.max(v - (zone.accel ?? course.gravity) * a2 * dt, target)
  }
  v = Math.max(v, course.crawl * a)
  car.speed = v
  car.distance += v * dt
  car.time += dt
}

/** Rides `car` on at scale `a` to `target` distance; the second it gets there (Infinity past `giveUp`). */
function rideTo(course: Course, car: Car, a: number, target: number, giveUp: number): number {
  while (car.distance < target) {
    if (car.time > giveUp) return Infinity
    const before = car.distance
    step(course, car, a)
    if (car.distance >= target) return car.time - (car.distance - target) / (car.distance - before) / PLAN_RATE
  }
  return car.time
}

/** The scale that gets the car from `start` to `target` at `second` (as close as `MIN_SCALE`..`MAX_SCALE` allow). */
function solveStretch(course: Course, start: Car, target: number, second: number): number {
  let lo = Math.log(MIN_SCALE)
  let hi = Math.log(MAX_SCALE)
  const trial: Car = { time: 0, distance: 0, speed: 0 }
  for (let k = 0; k < SOLVER_STEPS; k++) {
    const mid = (lo + hi) / 2
    Object.assign(trial, start)
    if (rideTo(course, trial, Math.exp(mid), target, second + 60) > second) lo = mid
    else hi = mid
  }
  return Math.exp((lo + hi) / 2)
}

function checkBeats(beats: readonly RideBeat[]): void {
  beats.forEach((beat, i) => {
    const prev = i > 0 ? beats[i - 1] : { at: 0, second: 0 }
    if (!(beat.at > prev.at && beat.second > prev.second)) throw new Error(`ride beat ${i} must come after the one before it`)
  })
}

/** Solves and rides the v2 ride on `table`'s track from a standing start at GO. */
export function buildRidePlan(table: ArcTable, spec: RideV2Spec): RidePlan {
  const course = buildCourse(table, spec)
  const beats = spec.beats ?? []
  checkBeats(beats)
  const scales: number[] = []
  const car: Car = { time: 0, distance: 0, speed: 0 }
  for (const beat of beats) {
    const target = beat.at * course.length
    const a = solveStretch(course, car, target, beat.second)
    scales.push(a)
    rideTo(course, car, a, target, Infinity)
  }
  scales.push(scales.length > 0 ? scales[scales.length - 1] : 1)

  const frames = HORIZON_SECONDS * PLAN_RATE
  const distance = new Float64Array(frames + 1)
  const speed = new Float64Array(frames + 1)
  const landed: number[] = []
  const ride: Car = { time: 0, distance: 0, speed: 0 }
  let minSpeed = Infinity
  let maxSpeed = 0
  for (let k = 1; k <= frames; k++) {
    const before = ride.distance
    step(course, ride, scales[landed.length])
    const beat = beats[landed.length]
    if (beat && ride.distance >= beat.at * course.length) {
      landed.push(ride.time - (ride.distance - beat.at * course.length) / (ride.distance - before) / PLAN_RATE)
    }
    distance[k] = ride.distance
    speed[k] = ride.speed
    minSpeed = Math.min(minSpeed, ride.speed)
    maxSpeed = Math.max(maxSpeed, ride.speed)
  }
  return { table, distance, speed, minSpeed, maxSpeed, scales, landed }
}

function frameAt(plan: RidePlan, time: number): number {
  return Math.min(Math.max(time * PLAN_RATE, 0), plan.distance.length - 1)
}

/** Arc distance ridden (not wrapped) `time` seconds after GO. */
export function planDistance(plan: RidePlan, time: number): number {
  const last = plan.distance.length - 1
  const x = frameAt(plan, time)
  if (x >= last) return plan.distance[last] + plan.speed[last] * (time - last / PLAN_RATE)
  const i = Math.floor(x)
  return plan.distance[i] + (plan.distance[i + 1] - plan.distance[i]) * (x - i)
}

/** Speed in world units per second `time` seconds after GO. */
export function planSpeed(plan: RidePlan, time: number): number {
  const last = plan.speed.length - 1
  const x = frameAt(plan, time)
  if (x >= last) return plan.speed[last]
  const i = Math.floor(x)
  return plan.speed[i] + (plan.speed[i + 1] - plan.speed[i]) * (x - i)
}

/** The first second the car has ridden `dist` (the inverse of `planDistance`). */
export function planTimeAt(plan: RidePlan, dist: number): number {
  const { distance } = plan
  const last = distance.length - 1
  if (dist <= 0) return 0
  if (dist >= distance[last]) return last / PLAN_RATE + (dist - distance[last]) / plan.speed[last]
  let lo = 0
  let hi = last
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (distance[mid] < dist) lo = mid
    else hi = mid
  }
  return (lo + (dist - distance[lo]) / (distance[hi] - distance[lo])) / PLAN_RATE
}
