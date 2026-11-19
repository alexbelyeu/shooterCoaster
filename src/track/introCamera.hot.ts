/**
 * The level's intro tour and the results orbit (#328). Through the intro (#674: its own fixed-length clock, after the
 * loading screen and before Ready / Set / GO) the camera tours the level (#675, built by `introTour.ts`) and lands in
 * the coaster seat on the ride camera's start pose; behind the results it circles the landmark. `CoasterCamera`
 * plays both and never moves the camera off the ride in `countdown` or `playing`.
 */
import type { Vec3Like } from './cameraRig.hot'
import { type IntroTour, type TourShot, tourDistance } from './introTour'
import { clampIntoBounds, type PlacementBounds } from '@/entities/spawning/spawnPlacement'
import { INTRO_SECONDS } from '@/core/introShot'

/** What a level's intro and results frame: its landmark (`BiomeDefinition.hero`, in each `biomes/<biome>/index.ts`). */
export interface HeroShot {
  /** The landmark's foot, world x / z. */
  x: number
  z: number
  /** The landmark's ground height when it isn't the terrain's there (a piece on an interior's wall, a sunken city). */
  ground?: number
  /** Height over the landmark's ground the camera looks at. */
  focus: number
  orbitRadius: number
  /** Camera height over the landmark's ground on the orbit. */
  orbitHeight: number
  /** A landmark on a wall swings through this half-angle (radians) round `facing` instead of circling it. */
  arc?: number
  /** Yaw (radians, `atan2(z, x)`) the arc is centred on: the way the landmark faces. */
  facing?: number
  /**
   * A seat inside a structure (the gym's Tree, #659): the tour's last leg rides the last this many world
   * units × trackScale of the track into the seat, which the track keeps clear, instead of flying over it.
   */
  approach?: number
  /** Hand-picked shots (world positions and look points) for the tour's reveal and landmark pass, in order (#675). */
  tour?: readonly TourShot[]
}

/** Orbit: a turn a minute, kept this far over the ground under the camera. */
export const ORBIT_RATE = (2 * Math.PI) / 60
const ORBIT_CLEARANCE = 40

/** Intro progress `seconds` in: 0 to 1 over `INTRO_SECONDS`, on the wall clock (the tour eases itself, `tourDistance`). */
export function introProgress(seconds: number): number {
  return Math.min(Math.max(seconds / INTRO_SECONDS, 0), 1)
}

/**
 * The camera at intro progress `p` along the level's `tour` (0 = the reveal, 1 = the seat): position into `outPos`,
 * unit look direction into `outDir`; returns the bank (radians, `rotateZ` after `lookAt`). Over the tour's last
 * `blend` it eases onto the live `seat` / `seatDir`, the ride camera's start pose, and at p = 1 it is exactly that.
 */
export function tourPose(tour: IntroTour, p: number, seat: Vec3Like, seatDir: Vec3Like, outPos: Vec3Like, outDir: Vec3Like): number {
  if (p >= 1) {
    outPos.x = seat.x
    outPos.y = seat.y
    outPos.z = seat.z
    outDir.x = seatDir.x
    outDir.y = seatDir.y
    outDir.z = seatDir.z
    return 0
  }
  const { dist, pos, look, bank, count, length } = tour
  const d = tourDistance(p) * length
  // The sample span holding `d`.
  let lo = 0
  let hi = count - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (dist[mid] <= d) lo = mid
    else hi = mid
  }
  const span = dist[hi] - dist[lo]
  const f = span > 1e-9 ? Math.min(Math.max((d - dist[lo]) / span, 0), 1) : 0
  const a = lo * 3
  const b = hi * 3
  // Onto the live seat over the last stretch: the same seat as built, unless the car has moved since.
  const w = smoothstep((d - (length - tour.blend)) / tour.blend)
  outPos.x = pos[a] + (pos[b] - pos[a]) * f + (seat.x - tour.seat.x) * w
  outPos.y = pos[a + 1] + (pos[b + 1] - pos[a + 1]) * f + (seat.y - tour.seat.y) * w
  outPos.z = pos[a + 2] + (pos[b + 2] - pos[a + 2]) * f + (seat.z - tour.seat.z) * w
  const x = (look[a] + (look[b] - look[a]) * f) * (1 - w) + seatDir.x * w
  const y = (look[a + 1] + (look[b + 1] - look[a + 1]) * f) * (1 - w) + seatDir.y * w
  const z = (look[a + 2] + (look[b + 2] - look[a + 2]) * f) * (1 - w) + seatDir.z * w
  const m = Math.hypot(x, y, z) || 1
  outDir.x = x / m
  outDir.y = y / m
  outDir.z = z / m
  return bank[lo] + (bank[hi] - bank[lo]) * f
}

function smoothstep(x: number): number {
  const t = Math.min(Math.max(x, 0), 1)
  return t * t * (3 - 2 * t)
}

/**
 * The results orbit `seconds` in: position into `outPos`, the point it looks at into `outTarget`. A full circle
 * starting at `startYaw`, or for a wall landmark (`hero.arc`) a swing round its facing; never under `heightAt`'s
 * ground + clearance, and inside an interior's `bounds`. `groundY` is the ground under the landmark.
 */
export function orbitPose(
  hero: HeroShot,
  groundY: number,
  seconds: number,
  startYaw: number,
  heightAt: (x: number, z: number) => number,
  bounds: PlacementBounds | undefined,
  outPos: Vec3Like,
  outTarget: Vec3Like,
): void {
  const yaw = hero.arc
    ? (hero.facing ?? 0) + hero.arc * Math.sin((seconds * ORBIT_RATE) / hero.arc)
    : startYaw + seconds * ORBIT_RATE
  outPos.x = hero.x + Math.cos(yaw) * hero.orbitRadius
  outPos.z = hero.z + Math.sin(yaw) * hero.orbitRadius
  outPos.y = Math.max(groundY + hero.orbitHeight, heightAt(outPos.x, outPos.z) + ORBIT_CLEARANCE)
  clampIntoBounds(outPos, bounds)
  outTarget.x = hero.x
  outTarget.y = groundY + hero.focus
  outTarget.z = hero.z
}
