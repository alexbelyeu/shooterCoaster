import type { ArcTable } from './arcLength'
import type { RideBeat, RideV2Spec, SpeedZone } from '@/types/level'

/**
 * The v2 ride (#696), pure: real speed (gravity with drag, a crawl floor, launches, lift hills and brakes) solved ahead
 * of time so the storyboard's beats land on their seconds. The result is a plan, distance and speed at every 60 fps
 * frame from GO: the live ride reads it by ride time (`ridePhysics.ts` `advanceRide`), so it is the same ride at any
 * frame rate and spawning predicts it exactly (`rideProfile`).
 *
 * The free ride is simulated once from a standing start; the solver then warps its time. Each stretch between two beats
 * rides at scale `a` (speed × a, eased in from the stretch before's): with gravity × a² and zone speeds × a that is the
 * same ride, 1 / a times as long, so slow crests and fast drops keep their shape and a carried-in speed can't push a
 * beat out of reach.
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
/** Share of a stretch over which the warp eases from the stretch before's scale to its own, so speed never jumps. */
const EASE_SHARE = 0.25

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
  const crawl = spec.crawl ?? RIDE_V2_DEFAULTS.crawl
  // A car that can stop never reaches the next beat: the solver would search for it forever.
  if (!(crawl > 0)) throw new Error('rideV2.crawl must be above 0')
  return {
    length: table.length,
    cell,
    slope,
    zone,
    zones,
    gravity: spec.gravity ?? RIDE_V2_DEFAULTS.gravity,
    drag: spec.drag ?? RIDE_V2_DEFAULTS.drag,
    crawl,
  }
}

/** One 60 fps frame of the free ride. */
function step(course: Course, car: Car): void {
  const dt = 1 / PLAN_RATE
  const wrapped = car.distance % course.length
  const i = Math.min(Math.floor(wrapped / course.cell), CELLS - 1)
  let v = car.speed + (-course.gravity * course.slope[i] - course.drag * car.speed * car.speed) * dt
  const z = course.zone[i]
  if (z >= 0) {
    const zone = course.zones[z]
    if (zone.kind === 'lift') v = Math.max(v, zone.speed)
    else if (zone.kind === 'launch' && v < zone.speed) v = Math.min(v + (zone.accel ?? zone.speed / 2) * dt, zone.speed)
    else if (zone.kind === 'brake' && v > zone.speed) v = Math.max(v - (zone.accel ?? course.gravity) * dt, zone.speed)
  }
  v = Math.max(v, course.crawl)
  car.speed = v
  car.distance += v * dt
}

/** The free ride from a standing start, one sample per 60 fps frame, simulated as far as it is read. */
class FreeRide {
  readonly distance: number[] = [0]
  readonly speed: number[] = [0]
  private readonly car: Car = { distance: 0, speed: 0 }
  constructor(private readonly course: Course) {}

  /** Makes sure sample `k` exists. */
  reach(k: number): void {
    while (this.distance.length <= k) {
      step(this.course, this.car)
      this.distance.push(this.car.distance)
      this.speed.push(this.car.speed)
    }
  }

  /** Makes sure the ride gets past `dist`. */
  reachDistance(dist: number): void {
    while (this.car.distance <= dist) this.reach(this.distance.length)
  }
}

/**
 * The warp's scale at distance `d` in stretch `i` (from `bounds[i - 1]`, 0 for the first, to `bounds[i]`): `scales[i]`,
 * eased in from the stretch before's over its first `EASE_SHARE`.
 */
function scaleAt(scales: readonly number[], bounds: readonly number[], i: number, d: number): number {
  if (i === 0 || i >= bounds.length) return scales[Math.min(i, scales.length - 1)]
  const from = bounds[i - 1]
  const ease = (bounds[i] - from) * EASE_SHARE
  const f = Math.min((d - from) / ease, 1)
  return scales[i - 1] + (scales[i] - scales[i - 1]) * f
}

/** Seconds stretch `i` takes, warped by `scales` (only `scales[i - 1]` and `scales[i]` matter). */
function stretchSeconds(free: FreeRide, bounds: readonly number[], scales: readonly number[], i: number): number {
  const from = i > 0 ? bounds[i - 1] : 0
  const to = bounds[i]
  let seconds = 0
  for (let k = 0; k + 1 < free.distance.length && free.distance[k] < to; k++) {
    const a = Math.max(free.distance[k], from)
    const b = Math.min(free.distance[k + 1], to)
    if (b <= a) continue
    const share = (b - a) / (free.distance[k + 1] - free.distance[k])
    seconds += share / PLAN_RATE / scaleAt(scales, bounds, i, (a + b) / 2)
  }
  return seconds
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
  const free = new FreeRide(course)
  const bounds = beats.map((beat) => beat.at * course.length)
  if (bounds.length > 0) free.reachDistance(bounds[bounds.length - 1])

  // Stretch by stretch, the scale that lands its beat (the time a stretch takes falls as its scale rises).
  const scales: number[] = []
  beats.forEach((beat, i) => {
    const seconds = beat.second - (i > 0 ? beats[i - 1].second : 0)
    let lo = Math.log(MIN_SCALE)
    let hi = Math.log(MAX_SCALE)
    for (let n = 0; n < SOLVER_STEPS; n++) {
      const mid = (lo + hi) / 2
      scales[i] = Math.exp(mid)
      if (i === 0) scales[1] = scales[0]
      if (stretchSeconds(free, bounds, scales, i) > seconds) lo = mid
      else hi = mid
    }
    scales[i] = Math.exp((lo + hi) / 2)
  })
  scales.length = beats.length
  scales.push(scales.length > 0 ? scales[scales.length - 1] : 1)

  // Ride the warped free ride and sample it at every 60 fps frame.
  const frames = HORIZON_SECONDS * PLAN_RATE
  const distance = new Float64Array(frames + 1)
  const speed = new Float64Array(frames + 1)
  const landed: number[] = []
  let minSpeed = Infinity
  let maxSpeed = 0
  let k = 0
  let stretch = 0
  /** Warped seconds at free sample k, and the scale over sample k to k + 1. */
  let time = 0
  let a = scales[0]
  const advance = () => {
    free.reach(k + 1)
    const d0 = free.distance[k]
    const d1 = free.distance[k + 1]
    while (stretch < bounds.length && d0 >= bounds[stretch]) stretch++
    a = scaleAt(scales, bounds, stretch, (d0 + d1) / 2)
    if (stretch < bounds.length && d1 >= bounds[stretch]) {
      landed.push(time + (bounds[stretch] - d0) / (d1 - d0) / PLAN_RATE / a)
    }
  }
  advance()
  for (let j = 1; j <= frames; j++) {
    const now = j / PLAN_RATE
    while (time + 1 / PLAN_RATE / a < now) {
      time += 1 / PLAN_RATE / a
      k++
      advance()
    }
    const f = (now - time) * PLAN_RATE * a
    distance[j] = free.distance[k] + (free.distance[k + 1] - free.distance[k]) * f
    speed[j] = a * (free.speed[k] + (free.speed[k + 1] - free.speed[k]) * f)
    minSpeed = Math.min(minSpeed, speed[j])
    maxSpeed = Math.max(maxSpeed, speed[j])
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
