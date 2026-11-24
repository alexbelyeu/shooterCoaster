/**
 * The intro's tour of the level (#675): a calm 10 s flight from a high reveal of the world, past its hero landmark
 * (`BiomeDefinition.hero`), along the last stretch of track into the seat, landing on the ride's start pose. Built
 * once per level mount from the track and the hero, so every level (and every `npm run new-world` one) gets one; a
 * hero's `tour` swaps in hand-picked shots for the reveal and landmark pass. `tourPose` (`introCamera.hot.ts`) plays it.
 */
import type { Vec3Like } from './cameraRig.hot'
import { type ArcTable, distanceAtT, tAtLoopDistance } from './arcLength'
import type { TrackCurve } from './curves/TrackCurve'
import type { HeroShot } from './introCamera.hot'
import { clampIntoBounds, type PlacementBounds } from '@/entities/spawning/spawnPlacement'
import { INTRO_SECONDS } from '@/core/introShot'
import { smoothstep } from '@/utils/ease'

/** A tour waypoint: where the camera is and the point it looks at there. */
export interface TourShot {
  at: Vec3Like
  look: Vec3Like
}

/** The tour as a dense polyline the camera runs along by distance (`tourPose`). */
export interface IntroTour {
  /** Samples along the path. */
  count: number
  /** Camera position and unit look direction per sample, xyz interleaved. */
  pos: Float32Array
  look: Float32Array
  /** Roll (radians, `rotateZ` after `lookAt`) into the turns per sample, level at both ends. */
  bank: Float32Array
  /** Path length up to each sample. */
  dist: Float32Array
  length: number
  /** The seat the tour was built to land on: a seat elsewhere at play time is blended in over `blend`. */
  seat: Vec3Like
  /** Path length at the end over which the camera eases onto the live seat pose. */
  blend: number
  /** Intro progress (0–1) at the tour's four shots: the reveal, the landmark pass, the track and the landing. */
  marks: { reveal: number; landmark: number; track: number; landing: number }
}

export interface TourInput {
  curve: TrackCurve
  table: ArcTable
  /** Ride progress at the seat. */
  seatT: number
  eyeHeight: number
  trackScale: number
  hero: HeroShot
  heroGround: number
  ground: (x: number, z: number) => number
  bounds?: PlacementBounds
}

/** The tour's fastest speed, world units × trackScale per second: unhurried even low over the track. */
export const TOUR_SPEED_CAP = 450
/** Shares of the intro spent speeding up out of the reveal and slowing into the seat. */
const EASE_IN = 0.14
const EASE_OUT = 0.32
/** Path length the intro covers at the top speed for one second of its length. */
const DISTANCE_PER_TOP_SPEED_SECOND = 1 - (EASE_IN + EASE_OUT) / 2

/** Distances in world units × trackScale. The glide in starts this far behind the seat, this high over it. */
const GLIDE = 700
const GLIDE_UP = 150
/** Headings (radians round from straight behind the seat) the glide may come in on. */
const GLIDE_FROM = [0, 0.6, -0.6, 1.2, -1.2]
/** It looks this far down the track ahead of the seat. */
const GLIDE_LOOK = 700
/** The landing comes down this far behind the seat, this high over it. */
const LAND_BACK = 80
const LAND_UP = 14
/** The seat looks this far ahead. */
const LOOK_AHEAD = 260
/** The reveal sits this many orbit radii out from the landmark, this far round from the pass (radians). */
const REVEAL_OUT = 1.5
const REVEAL_TURN = 1.1
const PASS_TURN = 0.45
/** The pass goes by this many orbit radii out from the landmark. */
export const PASS_OUT = 1.3
/** The reveal is at least this many track half-diagonals over the track's mean height: high enough to see the level. */
const REVEAL_RISE = 0.3
/** A track approach (`hero.approach`) is joined from this many times its length further back along the track's line. */
const APPROACH_LEAD = 0.6
/** The reveal is at least this many times its height over the pass out from it. */
const REVEAL_GLIDE = 1.5
/** Radius of the swing out round the glide's start, × trackScale. */
const SWING = 320
/** Least height over the ground anywhere off the landing, and how far inside an interior's walls. */
const CLEARANCE = 30
const WALL_MARGIN = 80
/** Bank (radians) per unit of heading change per world unit, × trackScale, and its ceiling. */
const BANK_GAIN = 45
const BANK_MAX = 7 * (Math.PI / 180)
/** Share of the tour's length either side of a point its turn is averaged over for the bank. */
const BANK_SMOOTHING = 0.06
const SAMPLES_PER_SPAN = 48
/** Evenly spaced samples the finished tour is stored as. */
const RESAMPLED = 900
/** Share of the path either side of a point it is averaged over (three passes), smoothing out small corners. */
const PATH_SMOOTHING = 0.008
/** Share of the tour's length either side of a point its look is averaged over (one box's worth; three passes of a
 *  `LOOK_PASSES_WIDTH`th of it spread about as far). */
const LOOK_SMOOTHING = 0.12
const LOOK_SMOOTHING_MIN = 260
const LOOK_PASSES_WIDTH = 1.4
/** The ground / wall lift starts this share of the path ahead of where it is needed (at least `CLAMP_EASE_MIN` × trackScale). */
const CLAMP_EASE = 0.07
const CLAMP_EASE_MIN = 120
/** How much the flight's turning counts against a layout next to the look's. */
const FLIGHT_TURN_WEIGHT = 0.25

/** Distance over a speed ramp of unit width at `x` of it: speed rises on a smoothstep, whose integral this is. */
function ramp(x: number): number {
  return x * x * x - (x * x * x * x) / 2
}

/** Intro progress (0–1) to the share of the tour's length flown: eased out of the reveal and into the seat. */
export function tourDistance(u: number): number {
  const t = Math.min(Math.max(u, 0), 1)
  let d: number
  if (t < EASE_IN) d = EASE_IN * ramp(t / EASE_IN)
  else if (t <= 1 - EASE_OUT) d = EASE_IN / 2 + (t - EASE_IN)
  else d = DISTANCE_PER_TOP_SPEED_SECOND - EASE_OUT * ramp((1 - t) / EASE_OUT)
  return d / DISTANCE_PER_TOP_SPEED_SECOND
}

/** The inverse of `tourDistance`, for the marks. */
function progressAt(share: number): number {
  let lo = 0
  let hi = 1
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (tourDistance(mid) < share) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

const vec = (x: number, y: number, z: number): Vec3Like => ({ x, y, z })

function trackAt(input: TourInput, back: number, up: number): { at: Vec3Like; tangent: Vec3Like } {
  const { curve, table, seatT } = input
  const t = tAtLoopDistance(table, distanceAtT(table, seatT) - back)
  const p = curve.getPointAt(t)
  const d = curve.getTangentAt(t)
  return { at: vec(p.x, p.y + up, p.z), tangent: vec(d.x, d.y, d.z) }
}

/** The input plus what every layout shares, worked out once per build. */
type BuildInput = TourInput & { spread: { centre: Vec3Like; radius: number } }

/** One way of laying the tour out; `buildIntroTour` tries them all and flies the smoothest. */
interface Layout {
  /** Which way round the landmark the reveal sits from the pass. */
  side: number
  /** The glide's length and height, × GLIDE and GLIDE_UP. */
  glide: number
  /** The glide comes in from this far (radians) round from straight behind the seat. */
  from: number
  /** A wide swing out to this side of the glide's start (0: none), for a glide that starts back the way the camera came. */
  swing: number
  /** Draws the reveal and the glide in (1: not at all) for a level too big for the speed cap. */
  shrink: number
}

/** The track's middle (bounding box centre, mean height) and half-diagonal. */
function trackSpread(table: ArcTable): { centre: Vec3Like; radius: number } {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  let sumY = 0
  for (let i = 0; i < table.count; i++) {
    minX = Math.min(minX, table.x[i])
    maxX = Math.max(maxX, table.x[i])
    minZ = Math.min(minZ, table.z[i])
    maxZ = Math.max(maxZ, table.z[i])
    sumY += table.y[i]
  }
  return { centre: vec((minX + maxX) / 2, sumY / table.count, (minZ + maxZ) / 2), radius: Math.hypot(maxX - minX, maxZ - minZ) / 2 }
}

/** The reveal and the landmark pass, generated: high and far out round the landmark, then past it toward the glide. */
function heroShots(input: BuildInput, glideStart: Vec3Like, layout: Layout): TourShot[] {
  const { hero, heroGround, trackScale } = input
  const { centre, radius } = input.spread
  const anchor = vec(hero.x, heroGround + hero.focus, hero.z)
  const toGlide = Math.atan2(glideStart.z - hero.z, glideStart.x - hero.x)
  // A landmark on a wall (`hero.arc`) is passed in front of it.
  const clampYaw = (yaw: number) => {
    if (!hero.arc) return yaw
    const facing = hero.facing ?? 0
    let d = yaw - facing
    d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI
    return facing + Math.min(Math.max(d, -hero.arc), hero.arc)
  }
  const revealYaw = clampYaw(toGlide + layout.side * (PASS_TURN + REVEAL_TURN * layout.shrink))
  const passYaw = clampYaw(toGlide + layout.side * PASS_TURN)
  const out = hero.orbitRadius * (1 + (REVEAL_OUT - 1) * layout.shrink)
  const reveal = vec(hero.x + Math.cos(revealYaw) * out, 0, hero.z + Math.sin(revealYaw) * out)
  reveal.y = Math.max(heroGround + hero.orbitHeight * 1.6, centre.y + radius * REVEAL_RISE, glideStart.y + 100 * trackScale)
  const passOut = hero.orbitRadius * PASS_OUT
  // Not far under the glide: a dive past the landmark and a climb back out of it would swing the view up and down.
  const passY = Math.max(heroGround + hero.orbitHeight, glideStart.y - 100 * trackScale)
  const pass = vec(hero.x + Math.cos(passYaw) * passOut, passY, hero.z + Math.sin(passYaw) * passOut)
  // Far enough out from the pass to come down to it at a glide, not a drop.
  const dx = reveal.x - pass.x
  const dz = reveal.z - pass.z
  const across = Math.hypot(dx, dz) || 1
  const need = (reveal.y - pass.y) * REVEAL_GLIDE
  if (across < need) {
    reveal.x = pass.x + (dx / across) * need
    reveal.z = pass.z + (dz / across) * need
  }
  // The reveal looks between the landmark and the level's middle, so it frames both.
  const revealLook = vec((anchor.x + centre.x) / 2, (anchor.y + centre.y) / 2, (anchor.z + centre.z) / 2)
  return [{ at: reveal, look: revealLook }, { at: pass, look: anchor }]
}

/**
 * The waypoints: reveal and landmark (generated or the hero's `tour`), then the glide in over the track behind the
 * seat, looking down the track ahead of it (the ride to come), the landing and the seat.
 */
function tourShots(input: BuildInput, seat: Vec3Like, seatDir: Vec3Like, layout: Layout): { shots: TourShot[]; landmarkIndex: number; trackIndex: number } {
  const { hero, trackScale, eyeHeight } = input
  const lookAhead = LOOK_AHEAD * trackScale
  const ahead = (along: number, look: number) => trackAt(input, -(along + look), 0).at
  let glide: TourShot[]
  if (hero.approach !== undefined) {
    // A seat inside a structure (the gym's Tree) rides the track in at eye height, which the track keeps clear.
    const back = hero.approach * trackScale
    // It looks out past the seat the whole way in: following the hairpin's own turn would whip the view round.
    glide = [1, 0.8, 0.6, 0.4, 0.2].map((share) => ({ at: trackAt(input, back * share, eyeHeight).at, look: ahead(0, lookAhead) }))
    // Onto it along the track's own line, which runs clear of the structure behind its start.
    const start = trackAt(input, back, eyeHeight)
    const lead = back * APPROACH_LEAD
    glide.unshift({ at: vec(start.at.x - start.tangent.x * lead, start.at.y - start.tangent.y * lead, start.at.z - start.tangent.z * lead), look: glide[0].look })
  } else {
    // Straight in, coming down, from behind the seat or `layout.from` round from there, settling onto the ride's
    // heading over the landing: following the track's own bends behind the seat would make it swerve.
    const h = Math.hypot(seatDir.x, seatDir.z) || 1
    const fx = seatDir.x / h
    const fz = seatDir.z / h
    const c = Math.cos(layout.from)
    const sn = Math.sin(layout.from)
    const gx = fx * c - fz * sn
    const gz = fz * c + fx * sn
    const reach = GLIDE * trackScale * layout.glide * Math.max(layout.shrink, 0.5)
    const rise = GLIDE_UP * trackScale * layout.glide
    const behind = (back: number, up: number, x = gx, z = gz) => vec(seat.x - x * back, seat.y + up, seat.z - z * back)
    glide = [
      { at: behind(reach, rise), look: ahead(0, GLIDE_LOOK * trackScale) },
      { at: behind(reach * 0.45, rise * 0.3), look: ahead(0, GLIDE_LOOK * trackScale * 0.6) },
      { at: behind(LAND_BACK * trackScale, LAND_UP * trackScale, fx, fz), look: ahead(0, lookAhead) },
    ]
  }
  const swing: TourShot[] = []
  if (layout.swing) {
    // Out to one side of the glide's start and round into it, for a landmark the glide starts back the way the camera came.
    const start = glide[0]
    const dx = glide[1].at.x - start.at.x
    const dz = glide[1].at.z - start.at.z
    const h = Math.hypot(dx, dz) || 1
    const r = SWING * trackScale
    swing.push({
      at: vec(start.at.x - (dx / h) * r * 0.6 - (dz / h) * r * layout.swing, start.at.y + GLIDE_UP * trackScale * 0.3, start.at.z - (dz / h) * r * 0.6 + (dx / h) * r * layout.swing),
      look: start.look,
    })
  }
  const lead = [...(hero.tour?.length ? hero.tour : heroShots(input, (swing[0] ?? glide[0]).at, layout)), ...swing]
  const seatShot = { at: seat, look: vec(seat.x + seatDir.x * lookAhead, seat.y + seatDir.y * lookAhead, seat.z + seatDir.z * lookAhead) }
  return { shots: [...lead, ...glide, seatShot], landmarkIndex: lead.length - swing.length - 1, trackIndex: lead.length + 1 }
}

/** Cumulative path length at each sample of `pos` (xyz interleaved). */
function pathDistances(pos: Float32Array, count: number): Float32Array {
  const dist = new Float32Array(count)
  for (let i = 1; i < count; i++) {
    dist[i] = dist[i - 1] + Math.hypot(pos[i * 3] - pos[i * 3 - 3], pos[i * 3 + 1] - pos[i * 3 - 2], pos[i * 3 + 2] - pos[i * 3 - 1])
  }
  return dist
}


/** `passes` running means of `values` over ±`radius` of path length (`dist`, rising): three are close to a Gaussian. */
function boxPasses(dist: Float32Array, values: Float32Array, radius: number, passes: number): Float32Array {
  const n = values.length
  let src = Float32Array.from(values)
  for (let pass = 0; pass < passes; pass++) {
    const out = new Float32Array(n)
    let lo = 0
    let hi = 0
    let sum = 0
    for (let i = 0; i < n; i++) {
      while (hi < n && dist[hi] <= dist[i] + radius) sum += src[hi++]
      while (dist[lo] < dist[i] - radius) sum -= src[lo++]
      out[i] = sum / (hi - lo)
    }
    src = out
  }
  return src
}

/**
 * A smooth offset at least as large as `need` everywhere `need` is non-zero, each sign on its own: the largest need
 * within ±`reach` (so the offset starts before it is needed), then three box passes of a third of that, whose span
 * stays inside the max's, so no sample gets less than it needs.
 */
function envelope(dist: Float32Array, need: Float32Array, reach: number): Float32Array {
  const n = need.length
  const up = new Float32Array(n)
  const down = new Float32Array(n)
  let lo = 0
  for (let i = 0; i < n; i++) {
    while (dist[lo] < dist[i] - reach) lo++
    let hi = 0
    let lw = 0
    for (let j = lo; j < n && dist[j] <= dist[i] + reach; j++) {
      if (need[j] > hi) hi = need[j]
      if (need[j] < lw) lw = need[j]
    }
    up[i] = hi
    down[i] = lw
  }
  const a = boxPasses(dist, up, reach / 3, 3)
  const b = boxPasses(dist, down, reach / 3, 3)
  for (let i = 0; i < n; i++) a[i] += b[i]
  return a
}

/**
 * One axis of a centripetal Catmull-Rom span between `p1` and `p2` (knot gaps `d0`–`d2`), written to `out` at
 * samples `first`… (stride 3, axis `ax`), `u` = k / SAMPLES_PER_SPAN for k in 0…`steps`.
 */
function catmullRomSpan(out: Float32Array, first: number, ax: number, steps: number, p0: number, p1: number, p2: number, p3: number, d0: number, d1: number, d2: number): void {
  // Tangents of the non-uniform form (Barry–Goldman), scaled to the span.
  const m1 = ((p1 - p0) / d0 - (p2 - p0) / (d0 + d1) + (p2 - p1) / d1) * d1
  const m2 = ((p2 - p1) / d1 - (p3 - p1) / (d1 + d2) + (p3 - p2) / d2) * d1
  for (let k = 0; k <= steps; k++) {
    const u = k / SAMPLES_PER_SPAN
    const u2 = u * u
    const u3 = u2 * u
    out[(first + k) * 3 + ax] = (2 * u3 - 3 * u2 + 1) * p1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2 + (u3 - u2) * m2
  }
}

/**
 * The waypoints as a dense path held clear of the ground, with its distances and smoothed look; null when the spline
 * alone is already longer than `budget` (the ground clearance, the costly part, is then skipped).
 */
function sampleTour(input: TourInput, shots: TourShot[], trackIndex: number, seatDir: Vec3Like, budget: number): (Omit<IntroTour, 'marks' | 'seat' | 'blend' | 'bank'> & { shotSamples: number[] }) | null {
  const n = shots.length
  const approach = input.hero.approach !== undefined
  // Phantom ends: the reveal's mirrored, and one ahead of the seat along the ride so the landing arrives along it.
  const first = shots[0]
  const second = shots[1]
  const last = shots[n - 1]
  const reach = Math.hypot(last.at.x - shots[n - 2].at.x, last.at.y - shots[n - 2].at.y, last.at.z - shots[n - 2].at.z)
  const pts: TourShot[] = [
    { at: vec(2 * first.at.x - second.at.x, 2 * first.at.y - second.at.y, 2 * first.at.z - second.at.z), look: vec(2 * first.look.x - second.look.x, 2 * first.look.y - second.look.y, 2 * first.look.z - second.look.z) },
    ...shots,
    { at: vec(last.at.x + seatDir.x * reach, last.at.y + seatDir.y * reach, last.at.z + seatDir.z * reach), look: vec(last.look.x + seatDir.x * reach, last.look.y + seatDir.y * reach, last.look.z + seatDir.z * reach) },
  ]
  const gap = (a: TourShot, b: TourShot) => Math.max(Math.sqrt(Math.hypot(b.at.x - a.at.x, b.at.y - a.at.y, b.at.z - a.at.z)), 1e-3)
  const count = (n - 1) * SAMPLES_PER_SPAN + 1
  const pos = new Float32Array(count * 3)
  const look = new Float32Array(count * 3)
  const shotSamples: number[] = []
  const axes = ['x', 'y', 'z'] as const
  for (let span = 0; span < n - 1; span++) {
    const [a, b, c, d] = [pts[span], pts[span + 1], pts[span + 2], pts[span + 3]]
    const d0 = gap(a, b)
    const d1 = gap(b, c)
    const d2 = gap(c, d)
    shotSamples.push(span * SAMPLES_PER_SPAN)
    const steps = span === n - 2 ? SAMPLES_PER_SPAN : SAMPLES_PER_SPAN - 1
    for (let ax = 0; ax < 3; ax++) {
      const key = axes[ax]
      catmullRomSpan(pos, span * SAMPLES_PER_SPAN, ax, steps, a.at[key], b.at[key], c.at[key], d.at[key], d0, d1, d2)
      catmullRomSpan(look, span * SAMPLES_PER_SPAN, ax, steps, a.look[key], b.look[key], c.look[key], d.look[key], d0, d1, d2)
    }
  }
  shotSamples.push(count - 1)
  let splineLength = 0
  for (let i = 3; i < count * 3; i += 3) splineLength += Math.hypot(pos[i] - pos[i - 3], pos[i + 1] - pos[i - 2], pos[i + 2] - pos[i - 1])
  if (splineLength > budget) return null

  // Clear of the ground and inside an interior's walls. A hard clamp per sample bumps the camera over every rise
  // and kinks where it lets go, so what each sample needs is lifted (or pushed in) as a smooth envelope: it
  // starts rising ahead of a hill and settles after it, then fades out before the seat so the landing is exact.
  const { ground, bounds, trackScale } = input
  const inner = bounds && { minX: bounds.minX + WALL_MARGIN, maxX: bounds.maxX - WALL_MARGIN, minZ: bounds.minZ + WALL_MARGIN, maxZ: bounds.maxZ - WALL_MARGIN, maxY: bounds.maxY - WALL_MARGIN }
  const rawDist = pathDistances(pos, count)
  const rawLength = rawDist[count - 1]
  // Off the ground up to the landing; on a track approach, only up to where it joins the track (kept clear).
  const clampTo = shotSamples[approach ? trackIndex : shotSamples.length - 2]
  const need = [new Float32Array(count), new Float32Array(count), new Float32Array(count)]
  const p = vec(0, 0, 0)
  for (let i = 0; i < clampTo; i++) {
    p.x = pos[i * 3]
    p.y = pos[i * 3 + 1]
    p.z = pos[i * 3 + 2]
    clampIntoBounds(p, inner)
    p.y = Math.max(p.y, ground(p.x, p.z) + CLEARANCE * trackScale)
    need[0][i] = p.x - pos[i * 3]
    need[1][i] = p.y - pos[i * 3 + 1]
    need[2][i] = p.z - pos[i * 3 + 2]
  }
  const ease = Math.max(rawLength * CLAMP_EASE, CLAMP_EASE_MIN * trackScale)
  // Fully applied up to `clampTo`, then eased out: over the landing to the seat, or ahead of a track approach.
  const fadeFrom = approach ? Math.max(rawDist[clampTo] - ease, 0) : rawDist[clampTo]
  const fadeTo = approach ? rawDist[clampTo] : rawLength
  for (let ax = 0; ax < 3; ax++) {
    const offset = envelope(rawDist, need[ax], ease)
    for (let i = 0; i < count; i++) {
      const fade = fadeTo > fadeFrom ? 1 - smoothstep((rawDist[i] - fadeFrom) / (fadeTo - fadeFrom)) : rawDist[i] < fadeTo ? 1 : 0
      pos[i * 3 + ax] += offset[i] * fade
    }
  }

  // Evenly spaced along the path: the spline's samples bunch up on short spans and spread out on long ones, and
  // \`tourPose\` curves through them as if they were even (a smooth camera needs both).
  const splineDist = pathDistances(pos, count)
  const length = splineDist[count - 1]
  const m = RESAMPLED
  const ePos = new Float32Array(m * 3)
  const eLook = new Float32Array(m * 3)
  const eDist = new Float32Array(m)
  let j = 1
  for (let i = 0; i < m; i++) {
    const d = (length * i) / (m - 1)
    while (j < count - 1 && splineDist[j] < d) j++
    const span = splineDist[j] - splineDist[j - 1]
    const f = span > 1e-9 ? Math.min(Math.max((d - splineDist[j - 1]) / span, 0), 1) : 0
    for (let k = 0; k < 3; k++) {
      ePos[i * 3 + k] = pos[(j - 1) * 3 + k] + (pos[j * 3 + k] - pos[(j - 1) * 3 + k]) * f
      eLook[i * 3 + k] = look[(j - 1) * 3 + k] + (look[j * 3 + k] - look[(j - 1) * 3 + k]) * f
    }
    eDist[i] = d
  }
  // A light smoothing of the path itself, held at both ends: the spline's own sample corners and the ground's
  // small bumps otherwise zig-zag the flight a little every frame.
  {
    const radius = length * PATH_SMOOTHING
    const axis = new Float32Array(m)
    for (let k = 0; k < 3; k++) {
      for (let i = 0; i < m; i++) axis[i] = ePos[i * 3 + k]
      const smoothed = boxPasses(eDist, axis, radius, 3)
      for (let i = 0; i < m; i++) {
        const hold = smoothstep(Math.min(eDist[i], length - eDist[i]) / (radius * 3))
        ePos[i * 3 + k] = axis[i] + (smoothed[i] - axis[i]) * hold
      }
    }
  }
  const eShots = shotSamples.map((sample) => Math.round((splineDist[sample] / length) * (m - 1)))

  // The look as a unit direction, averaged over a stretch of path round each sample: passing close by the
  // landmark, or handing the look from it to the track, it turns in a few seconds, not one.
  const raw = new Float32Array(m * 3)
  for (let i = 0; i < m; i++) {
    const x = eLook[i * 3] - ePos[i * 3]
    const y = eLook[i * 3 + 1] - ePos[i * 3 + 1]
    const z = eLook[i * 3 + 2] - ePos[i * 3 + 2]
    const l = Math.hypot(x, y, z) || 1
    raw[i * 3] = x / l
    raw[i * 3 + 1] = y / l
    raw[i * 3 + 2] = z / l
  }
  // Three box passes (close to a Gaussian): one pass turns the view at a rate that steps where a waypoint's
  // look enters or leaves the window, which reads as a lurch.
  const span = Math.max(length * LOOK_SMOOTHING, LOOK_SMOOTHING_MIN * trackScale) / LOOK_PASSES_WIDTH
  const axis = new Float32Array(m)
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i < m; i++) axis[i] = raw[i * 3 + k]
    const smoothed = boxPasses(eDist, axis, span, 3)
    for (let i = 0; i < m; i++) eLook[i * 3 + k] = smoothed[i]
  }
  for (let i = 0; i < m; i++) {
    const l = Math.hypot(eLook[i * 3], eLook[i * 3 + 1], eLook[i * 3 + 2]) || 1
    eLook[i * 3] /= l
    eLook[i * 3 + 1] /= l
    eLook[i * 3 + 2] /= l
  }

  return { count: m, pos: ePos, look: eLook, dist: eDist, length, shotSamples: eShots }
}

type Sampled = NonNullable<ReturnType<typeof sampleTour>>

/** Bank into the turns by the heading's change along the path, smoothed, level at both ends. */
function tourBank(tour: Sampled, trackScale: number): Float32Array {
  const { count, pos, dist, length } = tour
  const turn = new Float32Array(count)
  for (let i = 1; i < count - 1; i++) {
    const h0 = Math.atan2(pos[i * 3 + 2] - pos[i * 3 - 1], pos[i * 3] - pos[i * 3 - 3])
    const h1 = Math.atan2(pos[i * 3 + 5] - pos[i * 3 + 2], pos[i * 3 + 3] - pos[i * 3])
    let dh = h1 - h0
    dh -= Math.round(dh / (2 * Math.PI)) * 2 * Math.PI
    const ds = (dist[i + 1] - dist[i - 1]) / 2
    turn[i] = ds > 1e-6 ? dh / ds : 0
  }
  const smoothed = boxPasses(dist, turn, Math.max(length * BANK_SMOOTHING, LOOK_SMOOTHING_MIN * trackScale) / LOOK_PASSES_WIDTH, 3)
  const bank = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const ends = Math.sin(Math.PI * (length > 0 ? dist[i] / length : 0))
    bank[i] = Math.min(Math.max(-smoothed[i] * BANK_GAIN * trackScale, -BANK_MAX), BANK_MAX) * ends * ends
  }
  return bank
}

/**
 * The tour's sharpest turns, degrees a second as flown (`tourDistance` over INTRO_SECONDS): the look's, and the
 * flight's own heading while it is moving at more than a third of its top speed (a turn on the spot reads as none).
 * The look is what a player feels turn; the flight, with the look held, reads as the world drifting by.
 */
export function tourTurnRates(tour: Pick<IntroTour, 'pos' | 'look' | 'dist' | 'count' | 'length'>): { look: number; flight: number } {
  const { count, dist, pos, look: lookDir } = tour
  const frames = INTRO_SECONDS * 30
  const top = tour.length / (INTRO_SECONDS * DISTANCE_PER_TOP_SPEED_SECOND)
  // The sample index only moves forward: the frames' distances rise.
  let i = 1
  const p = [0, 0, 0]
  const l = [0, 0, 0]
  const prevPos = [0, 0, 0]
  const prevLook = [0, 0, 0]
  const move = [0, 0, 0]
  const prevMove = [0, 0, 0]
  let look = 0
  let flight = 0
  for (let frame = 0; frame <= frames; frame++) {
    const d = tourDistance(frame / frames) * tour.length
    while (i < count - 1 && dist[i] < d) i++
    const span = dist[i] - dist[i - 1]
    const f = span > 1e-9 ? Math.min(Math.max((d - dist[i - 1]) / span, 0), 1) : 0
    for (let k = 0; k < 3; k++) {
      p[k] = pos[(i - 1) * 3 + k] + (pos[i * 3 + k] - pos[(i - 1) * 3 + k]) * f
      l[k] = lookDir[(i - 1) * 3 + k] + (lookDir[i * 3 + k] - lookDir[(i - 1) * 3 + k]) * f
      move[k] = p[k] - prevPos[k]
    }
    if (frame > 0) look = Math.max(look, angle(l, prevLook))
    if (frame > 1 && Math.hypot(move[0], move[1], move[2]) * 30 > top / 3) flight = Math.max(flight, angle(move, prevMove))
    for (let k = 0; k < 3; k++) {
      prevPos[k] = p[k]
      prevLook[k] = l[k]
      prevMove[k] = move[k]
    }
  }
  const perSecond = (30 * 180) / Math.PI
  return { look: look * perSecond, flight: flight * perSecond }
}

function angle(a: number[], b: number[]): number {
  const la = Math.hypot(a[0], a[1], a[2])
  const lb = Math.hypot(b[0], b[1], b[2])
  if (la < 1e-9 || lb < 1e-9) return 0
  return Math.acos(Math.min(Math.max((a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (la * lb), -1), 1))
}

/** The level's tour into the seat at ride progress `seatT` (cold: once per level mount). */
export function buildIntroTour(tourInput: TourInput): IntroTour {
  const input: BuildInput = { ...tourInput, spread: trackSpread(tourInput.table) }
  const { curve, seatT, eyeHeight, trackScale } = input
  const sp = curve.getPointAt(seatT)
  const st = curve.getTangentAt(seatT)
  const seat = vec(sp.x, sp.y + eyeHeight, sp.z)
  const seatDir = vec(st.x, st.y, st.z)
  const budget = TOUR_SPEED_CAP * trackScale * INTRO_SECONDS * DISTANCE_PER_TOP_SPEED_SECOND
  let best: { built: Sampled; shots: ReturnType<typeof tourShots>; rate: number } | null = null
  for (const side of [1, -1]) {
    for (const glide of [0.7, 1.2]) {
      for (const from of GLIDE_FROM) {
       for (const swing of [0, 1, -1]) {
        // A level too big for the cap draws the reveal and the glide in until the tour fits.
        const layout: Layout = { side, glide, from, swing, shrink: 1 }
        let shots = tourShots(input, seat, seatDir, layout)
        let built = sampleTour(input, shots.shots, shots.trackIndex, seatDir, budget)
        for (let tries = 0; (!built || built.length > budget) && tries < 8; tries++) {
          layout.shrink *= 0.85
          shots = tourShots(input, seat, seatDir, layout)
          built = sampleTour(input, shots.shots, shots.trackIndex, seatDir, budget)
        }
        if (!built || built.length > budget) continue
        const turns = tourTurnRates(built)
        const rate = Math.max(turns.look, turns.flight * FLIGHT_TURN_WEIGHT)
        if (!best || rate < best.rate) best = { built, shots, rate }
       }
      }
    }
  }
  if (!best) throw new Error('buildIntroTour: no layout fits the speed cap')
  const { shotSamples, ...tour } = best.built
  const at = (sample: number) => progressAt(tour.dist[sample] / tour.length)
  return {
    ...tour,
    bank: tourBank(best.built, trackScale),
    seat,
    blend: Math.min(tour.length * 0.1, LAND_BACK * trackScale),
    marks: {
      reveal: 0.04,
      landmark: at(shotSamples[best.shots.landmarkIndex]),
      track: at(shotSamples[best.shots.trackIndex]),
      landing: progressAt(1 - (LAND_BACK * trackScale) / 2 / tour.length),
    },
  }
}
