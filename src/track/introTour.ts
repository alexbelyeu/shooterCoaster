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
const PASS_OUT = 1.3
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
const SAMPLES_PER_SPAN = 48
/** Share of the tour's length either side of a point its look is averaged over. */
const LOOK_SMOOTHING = 0.1
const LOOK_SMOOTHING_MIN = 260
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
function heroShots(input: TourInput, glideStart: Vec3Like, layout: Layout): TourShot[] {
  const { hero, heroGround, trackScale, table } = input
  const { centre, radius } = trackSpread(table)
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
function tourShots(input: TourInput, seat: Vec3Like, seatDir: Vec3Like, layout: Layout): { shots: TourShot[]; landmarkIndex: number; trackIndex: number } {
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
  const lead = [...(hero.tour ?? heroShots(input, (swing[0] ?? glide[0]).at, layout)), ...swing]
  const seatShot = { at: seat, look: vec(seat.x + seatDir.x * lookAhead, seat.y + seatDir.y * lookAhead, seat.z + seatDir.z * lookAhead) }
  return { shots: [...lead, ...glide, seatShot], landmarkIndex: lead.length - swing.length - 1, trackIndex: lead.length + 1 }
}

/** Centripetal Catmull-Rom point between `p1` and `p2` at `u` (0–1) with knot gaps `d0`–`d2`. */
function catmullRom(p0: number, p1: number, p2: number, p3: number, d0: number, d1: number, d2: number, u: number): number {
  // Tangents of the non-uniform form (Barry–Goldman), scaled to the span.
  const m1 = ((p1 - p0) / d0 - (p2 - p0) / (d0 + d1) + (p2 - p1) / d1) * d1
  const m2 = ((p2 - p1) / d1 - (p3 - p1) / (d1 + d2) + (p3 - p2) / d2) * d1
  const u2 = u * u
  const u3 = u2 * u
  return (2 * u3 - 3 * u2 + 1) * p1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2 + (u3 - u2) * m2
}

function sampleTour(input: TourInput, shots: TourShot[], seatDir: Vec3Like): Omit<IntroTour, 'marks' | 'seat' | 'blend'> & { shotSamples: number[] } {
  const n = shots.length
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
    for (let k = 0; k <= steps; k++) {
      const i = span * SAMPLES_PER_SPAN + k
      const u = k / SAMPLES_PER_SPAN
      for (let ax = 0; ax < 3; ax++) {
        const key = axes[ax]
        pos[i * 3 + ax] = catmullRom(a.at[key], b.at[key], c.at[key], d.at[key], d0, d1, d2, u)
        look[i * 3 + ax] = catmullRom(a.look[key], b.look[key], c.look[key], d.look[key], d0, d1, d2, u)
      }
    }
  }
  shotSamples.push(count - 1)

  // Clear of the ground and inside an interior's walls, letting go over the landing so it reaches the seat.
  const { ground, bounds, trackScale } = input
  const inner = bounds && { minX: bounds.minX + WALL_MARGIN, maxX: bounds.maxX - WALL_MARGIN, minZ: bounds.minZ + WALL_MARGIN, maxZ: bounds.maxZ - WALL_MARGIN, maxY: bounds.maxY - WALL_MARGIN }
  const landing = shotSamples[shotSamples.length - 2]
  const p = vec(0, 0, 0)
  for (let i = 0; i < landing; i++) {
    p.x = pos[i * 3]
    p.y = pos[i * 3 + 1]
    p.z = pos[i * 3 + 2]
    clampIntoBounds(p, inner)
    p.y = Math.max(p.y, ground(p.x, p.z) + CLEARANCE * trackScale)
    pos[i * 3] = p.x
    pos[i * 3 + 1] = p.y
    pos[i * 3 + 2] = p.z
  }

  const dist = new Float32Array(count)
  for (let i = 1; i < count; i++) {
    dist[i] = dist[i - 1] + Math.hypot(pos[i * 3] - pos[i * 3 - 3], pos[i * 3 + 1] - pos[i * 3 - 2], pos[i * 3 + 2] - pos[i * 3 - 1])
  }
  const length = dist[count - 1]

  // The look as a unit direction, averaged over a stretch of path round each sample: passing close by the
  // landmark, or handing the look from it to the track, it turns in a few seconds, not one.
  const raw = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const x = look[i * 3] - pos[i * 3]
    const y = look[i * 3 + 1] - pos[i * 3 + 1]
    const z = look[i * 3 + 2] - pos[i * 3 + 2]
    const l = Math.hypot(x, y, z) || 1
    raw[i * 3] = x / l
    raw[i * 3 + 1] = y / l
    raw[i * 3 + 2] = z / l
  }
  const span = Math.max(length * LOOK_SMOOTHING, LOOK_SMOOTHING_MIN * trackScale)
  let lo = 0
  let hi = 0
  const sum = [0, 0, 0]
  for (let i = 0; i < count; i++) {
    while (hi < count && dist[hi] <= dist[i] + span) {
      for (let k = 0; k < 3; k++) sum[k] += raw[hi * 3 + k]
      hi++
    }
    while (dist[lo] < dist[i] - span) {
      for (let k = 0; k < 3; k++) sum[k] -= raw[lo * 3 + k]
      lo++
    }
    const l = Math.hypot(sum[0], sum[1], sum[2]) || 1
    for (let k = 0; k < 3; k++) look[i * 3 + k] = sum[k] / l
  }

  // Bank into the turns by the heading's change along the path, smoothed, level at both ends.
  const turn = new Float32Array(count)
  for (let i = 1; i < count - 1; i++) {
    const h0 = Math.atan2(pos[i * 3 + 2] - pos[i * 3 - 1], pos[i * 3] - pos[i * 3 - 3])
    const h1 = Math.atan2(pos[i * 3 + 5] - pos[i * 3 + 2], pos[i * 3 + 3] - pos[i * 3])
    let dh = h1 - h0
    dh -= Math.round(dh / (2 * Math.PI)) * 2 * Math.PI
    const ds = (dist[i + 1] - dist[i - 1]) / 2
    turn[i] = ds > 1e-6 ? dh / ds : 0
  }
  const bank = new Float32Array(count)
  const bankWindow = SAMPLES_PER_SPAN / 2
  for (let i = 0; i < count; i++) {
    let sum = 0
    let m = 0
    for (let j = Math.max(0, i - bankWindow); j <= Math.min(count - 1, i + bankWindow); j++) {
      sum += turn[j]
      m++
    }
    const ends = Math.sin(Math.PI * (length > 0 ? dist[i] / length : 0))
    bank[i] = Math.min(Math.max((-sum / m) * BANK_GAIN * trackScale, -BANK_MAX), BANK_MAX) * ends * ends
  }
  return { count, pos, look, bank, dist, length, shotSamples }
}

type Sampled = ReturnType<typeof sampleTour>

/**
 * The tour's sharpest turns, degrees a second as flown (`tourDistance` over INTRO_SECONDS): the look's, and the
 * flight's own heading while it is moving at more than a third of its top speed (a turn on the spot reads as none).
 * The look is what a player feels turn; the flight, with the look held, reads as the world drifting by.
 */
export function tourTurnRates(tour: Pick<IntroTour, 'pos' | 'look' | 'dist' | 'count' | 'length'>): { look: number; flight: number } {
  const frames = INTRO_SECONDS * 30
  const at = (d: number, src: Float32Array, out: number[]) => {
    let i = 1
    while (i < tour.count - 1 && tour.dist[i] < d) i++
    const span = tour.dist[i] - tour.dist[i - 1]
    const f = span > 1e-9 ? Math.min(Math.max((d - tour.dist[i - 1]) / span, 0), 1) : 0
    for (let k = 0; k < 3; k++) out[k] = src[(i - 1) * 3 + k] + (src[i * 3 + k] - src[(i - 1) * 3 + k]) * f
  }
  const angle = (a: number[], b: number[]) => {
    const la = Math.hypot(a[0], a[1], a[2])
    const lb = Math.hypot(b[0], b[1], b[2])
    if (la < 1e-9 || lb < 1e-9) return 0
    return Math.acos(Math.min(Math.max((a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (la * lb), -1), 1))
  }
  const top = tour.length / (INTRO_SECONDS * DISTANCE_PER_TOP_SPEED_SECOND)
  const p = [0, 0, 0]
  const l = [0, 0, 0]
  let prevPos = [0, 0, 0]
  let prevLook = [0, 0, 0]
  let prevMove = [0, 0, 0]
  let look = 0
  let flight = 0
  for (let i = 0; i <= frames; i++) {
    at(tourDistance(i / frames) * tour.length, tour.pos, p)
    at(tourDistance(i / frames) * tour.length, tour.look, l)
    const view = [...l]
    const move = [p[0] - prevPos[0], p[1] - prevPos[1], p[2] - prevPos[2]]
    if (i > 0) look = Math.max(look, angle(view, prevLook))
    if (i > 1 && Math.hypot(move[0], move[1], move[2]) * 30 > top / 3) flight = Math.max(flight, angle(move, prevMove))
    prevPos = [...p]
    prevLook = view
    prevMove = move
  }
  const perSecond = (30 * 180) / Math.PI
  return { look: look * perSecond, flight: flight * perSecond }
}

/** The level's tour into the seat at ride progress `seatT` (cold: once per level mount). */
export function buildIntroTour(input: TourInput): IntroTour {
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
        let built = sampleTour(input, shots.shots, seatDir)
        for (let tries = 0; built.length > budget && tries < 8; tries++) {
          layout.shrink *= 0.85
          shots = tourShots(input, seat, seatDir, layout)
          built = sampleTour(input, shots.shots, seatDir)
        }
        if (built.length > budget) continue
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
