import type { ArcTable } from './arcLength'
import type { RideBeat, RideHold, RideV2Spec, SpeedZone } from '@/types/level'

/**
 * The v2 ride (#696), pure: real speed (gravity with drag, a crawl floor, launches, lift hills and brakes) solved ahead
 * of time so the storyboard's beats land on their seconds. The result is a plan, distance and speed at every 60 fps
 * frame from GO: the live ride reads it by ride time (`ridePhysics.ts` `advanceRide`), so it is the same ride at any
 * frame rate and spawning predicts it exactly (`rideProfile`).
 *
 * The free ride is simulated once from a standing start; the solver then warps its time. Each stretch between two beats
 * rides at scale `a` (speed × a, eased in from the stretch before's): with gravity × a² and zone speeds × a that is the
 * same ride, 1 / a times as long, so slow crests and fast drops keep their shape and a carried-in speed can't push a
 * beat out of reach. A hold (a stop: a drop track's top, a turntable, #699) is never warped: it lasts its seconds.
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
  zones: readonly SpeedZone[]
  /** Every stop the plan rides, in order: seconds after GO it starts and ends, and the arc distance (not wrapped) it holds at. */
  stops: PlanStop[]
}

export interface PlanStop {
  start: number
  end: number
  distance: number
}

interface Course {
  length: number
  cell: number
  /** Rise per unit of arc in each cell. */
  slope: Float64Array
  /** The zone over each cell, -1 for none. */
  zone: Int16Array
  zones: readonly SpeedZone[]
  /** Stops by arc distance within a lap, in order, and the 60 fps frames each lasts. */
  holds: { distance: number; frames: number }[]
  gravity: number
  drag: number
  crawl: number
}

interface Car {
  distance: number
  speed: number
  /** Frames of the current stop still to wait. */
  holding: number
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
    holds: courseHolds(spec.holds ?? [], table.length),
  }
}

function courseHolds(holds: readonly RideHold[], length: number): Course['holds'] {
  for (const hold of holds) {
    if (!(hold.at > 0 && hold.at < 1)) throw new Error('rideV2 hold.at must be inside the lap (0..1)')
    if (!(hold.seconds > 0)) throw new Error('rideV2 hold.seconds must be above 0')
  }
  return holds
    .map((hold) => ({ distance: hold.at * length, frames: Math.round(hold.seconds * PLAN_RATE) }))
    .sort((a, b) => a.distance - b.distance)
}

/** The first stop past `from` and up to `to` (arc distances, not wrapped): where it is and its frames, or null. */
function stopBetween(course: Course, from: number, to: number): { at: number; frames: number } | null {
  const lap = Math.floor(from / course.length) * course.length
  for (const base of [lap, lap + course.length]) {
    for (const hold of course.holds) {
      const at = base + hold.distance
      if (at > from && at <= to) return { at, frames: hold.frames }
    }
  }
  return null
}

/** A brake's deceleration; a stop's approach coasts until it must brake at its rate to reach its speed at its end. */
function brakeRate(course: Course, zone: SpeedZone, wrapped: number, v: number): number {
  const rate = zone.accel ?? course.gravity
  if (!zone.stop) return rate
  const left = (((zone.to * course.length - wrapped) % course.length) + course.length) % course.length
  const needed = (v * v - zone.speed * zone.speed) / (2 * Math.max(left, 1e-6))
  return needed >= rate ? needed : 0
}

/** One 60 fps frame of the free ride; true while the car waits at a stop. */
function step(course: Course, car: Car): boolean {
  const dt = 1 / PLAN_RATE
  if (car.holding > 0) {
    car.holding--
    return true
  }
  const wrapped = car.distance % course.length
  const i = Math.min(Math.floor(wrapped / course.cell), CELLS - 1)
  let v = car.speed + (-course.gravity * course.slope[i] - course.drag * car.speed * car.speed) * dt
  const z = course.zone[i]
  if (z >= 0) {
    const zone = course.zones[z]
    if (zone.kind === 'lift') v = Math.max(v, zone.speed)
    else if (zone.kind === 'launch' && v < zone.speed) v = Math.min(v + (zone.accel ?? zone.speed / 2) * dt, zone.speed)
    else if (zone.kind === 'brake' && v > zone.speed) v = Math.max(v - brakeRate(course, zone, wrapped, v) * dt, zone.speed)
  }
  v = Math.max(v, course.crawl)
  const next = car.distance + v * dt
  const stop = stopBetween(course, car.distance, next)
  if (stop) {
    car.speed = 0
    car.distance = stop.at
    car.holding = stop.frames
    return false
  }
  car.speed = v
  car.distance = next
  return false
}

/** The free ride from a standing start, one sample per 60 fps frame, simulated as far as it is read. */
class FreeRide {
  readonly distance: number[] = [0]
  readonly speed: number[] = [0]
  /** `held[k]`: the car waits at a stop from sample k to k + 1. */
  readonly held: boolean[] = []
  private readonly car: Car = { distance: 0, speed: 0, holding: 0 }
  constructor(private readonly course: Course) {}

  /** Makes sure sample `k` exists. */
  reach(k: number): void {
    while (this.distance.length <= k) {
      this.held.push(step(this.course, this.car))
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
    if (free.held[k]) {
      if (free.distance[k] >= from) seconds += 1 / PLAN_RATE
      continue
    }
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
  const stops: PlanStop[] = []
  let minSpeed = Infinity
  let maxSpeed = 0
  let k = 0
  let stretch = 0
  /** Warped seconds at free sample k, and the scale over sample k to k + 1 (1 at a stop: it lasts its seconds). */
  let time = 0
  let a = scales[0]
  const advance = () => {
    free.reach(k + 1)
    const d0 = free.distance[k]
    const d1 = free.distance[k + 1]
    while (stretch < bounds.length && d0 >= bounds[stretch]) stretch++
    if (free.held[k]) {
      a = 1
      const last = stops[stops.length - 1]
      if (k > 0 && free.held[k - 1] && last) last.end = time + 1 / PLAN_RATE
      else stops.push({ start: time, end: time + 1 / PLAN_RATE, distance: d0 })
      return
    }
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
    speed[j] = free.held[k] ? 0 : a * (free.speed[k] + (free.speed[k + 1] - free.speed[k]) * f)
    // A stop isn't the ride's slowest, nor are the frames easing into or out of it (one end at rest): the wind and FOV
    // scale between running speeds.
    if (free.speed[k] > 0 && free.speed[k + 1] > 0) minSpeed = Math.min(minSpeed, speed[j])
    maxSpeed = Math.max(maxSpeed, speed[j])
  }
  return { table, distance, speed, minSpeed, maxSpeed, scales, landed, zones: spec.zones ?? [], stops }
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

/** The kind of zone the car is in `time` seconds after GO, or null between zones. */
export function planZoneAt(plan: RidePlan, time: number): SpeedZone['kind'] | null {
  const lap = plan.table.length
  const share = (((planDistance(plan, time) % lap) + lap) % lap) / lap
  for (const zone of plan.zones) if (inZone(zone, share)) return zone.kind
  return null
}

/** Seconds after a stop's end that still read as its end (share 1): the car is still on the stop, not moving on it (#719). */
const STOP_END_SLACK = 1e-6

/** How far through a stop the car is `time` seconds after GO (0..1), or -1 while it isn't stopped. */
export function planStopShare(plan: RidePlan, time: number): number {
  for (const stop of plan.stops) {
    if (time < stop.start) return -1
    if (time < stop.end + STOP_END_SLACK) return Math.min((time - stop.start) / (stop.end - stop.start), 1)
  }
  return -1
}
