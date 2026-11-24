import type { ArcTable } from '@/track/arcLength'
import { buildTrackIndex } from '@/levels/environments/shared/trackClearance'
import type { Tower } from './cityLayout'
import { STREET_GRID } from './config'

/**
 * Neon Metropolis's elevated highway (#921), pure: a straight deck on pylons from `from` to `to`, ramping down to the
 * street at both ends. The route is fitted to level7's ride (`highwayLayout.test.ts` holds it to the fit): the street out
 * of the first drop runs under the deck, the ride's near miss (`cityTrack.ts` builds its head-chopper from `HIGHWAY` and
 * `DECK`). A new track re-fits the route by moving its two ends or its deck height until that test passes.
 */

export interface HighwayRoute {
  from: { x: number; z: number }
  to: { x: number; z: number }
  /** Height of the road surface over the street (world units) between the ramps. */
  deck: number
}

/**
 * Level7's route: along x through the blocks north of the z = -600 street, from beside the first drop's towers out to the
 * edge of the city. The ride passes under it 20 s in, its eye just under the slab (the head-chopper, #871).
 */
export const HIGHWAY: HighwayRoute = { from: { x: 120, z: -720 }, to: { x: 2160, z: -720 }, deck: 47 }

/** The deck's cross-section (world units): road width, slab depth under the road, parapet height and thickness. */
export const DECK = { width: 52, thickness: 7, parapet: 3.5, wall: 1.6 } as const
/** Each ramp's length: the deck rises from the street to `deck` over this. */
export const RAMP = 300
/** A pylon's square column, its cap beam's depth, and the least gap between pylons. */
export const PYLON = { size: 10, cap: 6, spacing: 96 } as const
/** No pylon nearer the track's ground projection than this past its own half width (the support towers' legs splay). */
const PYLON_TRACK_CLEARANCE = 30
/** Pylons stand only where the deck is at least this high: the ramps' low ends rest on the street. */
const PYLON_MIN_HEIGHT = 20
/** Pylon candidates are tried this far apart along the route. */
const PYLON_STEP = 8

export function routeLength(route: HighwayRoute): number {
  return Math.hypot(route.to.x - route.from.x, route.to.z - route.from.z)
}

/** Unit direction of travel (x, z) from `from` to `to`. */
export function routeDirection(route: HighwayRoute): { dx: number; dz: number } {
  const length = routeLength(route)
  return { dx: (route.to.x - route.from.x) / length, dz: (route.to.z - route.from.z) / length }
}

/** Height of the road surface `u` along the route: smooth ramps up from the street at both ends, `deck` between. */
export function deckHeightAt(route: HighwayRoute, u: number): number {
  const k = Math.min(1, Math.max(0, Math.min(u, routeLength(route) - u) / RAMP))
  return route.deck * k * k * (3 - 2 * k)
}

/** (x, z) in the route's frame: `u` along it from `from`, `v` across it (left of travel positive). */
export function routeCoords(route: HighwayRoute, x: number, z: number): { u: number; v: number } {
  const { dx, dz } = routeDirection(route)
  const rx = x - route.from.x
  const rz = z - route.from.z
  return { u: rx * dx + rz * dz, v: rz * dx - rx * dz }
}

/** Is (x, z) within `margin` of the deck's footprint (ramps included)? */
export function nearHighway(route: HighwayRoute, x: number, z: number, margin: number): boolean {
  const { u, v } = routeCoords(route, x, z)
  return Math.abs(v) < DECK.width / 2 + margin && u > -margin && u < routeLength(route) + margin
}

/** Distance from `c` to the nearest street centre line of `STREET_GRID` along the same axis. */
function streetDistance(c: number): number {
  const { pitch } = STREET_GRID
  return Math.abs(pitch / 2 - Math.abs(c - Math.round(c / pitch) * pitch))
}

/** Does a square of half width `half` at (x, z) reach into a street? */
function inStreet(x: number, z: number, half: number): boolean {
  const reach = STREET_GRID.street / 2 + half
  return streetDistance(x) < reach || streetDistance(z) < reach
}

export interface Pylon {
  x: number
  z: number
  /** Height of the road surface above it. */
  deck: number
}

/** The pylons, `PYLON.spacing` apart or more: each on a block (the traffic runs on), clear of the track, under a high enough deck. */
export function highwayPylons(route: HighwayRoute, track: ArcTable): Pylon[] {
  const index = buildTrackIndex(track)
  const { dx, dz } = routeDirection(route)
  const half = PYLON.size / 2
  const pylons: Pylon[] = []
  let last = -Infinity
  for (let u = 0; u <= routeLength(route); u += PYLON_STEP) {
    const deck = deckHeightAt(route, u)
    if (u - last < PYLON.spacing || deck < PYLON_MIN_HEIGHT) continue
    const x = route.from.x + dx * u
    const z = route.from.z + dz * u
    if (inStreet(x, z, half) || index.near(x, z, half + PYLON_TRACK_CLEARANCE)) continue
    pylons.push({ x, z, deck })
    last = u
  }
  return pylons
}

/** Footprint step of `highwayObstacles`. */
const OBSTACLE_STEP = 40

/** The deck as boxes standing on the street (`Tower`s), for the air enemies' clearance: nothing hovers in or under the road. */
export function highwayObstacles(route: HighwayRoute): Tower[] {
  const { dx, dz } = routeDirection(route)
  const length = routeLength(route)
  const boxes: Tower[] = []
  for (let u = OBSTACLE_STEP / 2; u < length; u += OBSTACLE_STEP) {
    boxes.push({
      x: route.from.x + dx * u,
      z: route.from.z + dz * u,
      // An axis-aligned box round this step's oriented piece of the deck
      w: Math.abs(dx) * OBSTACLE_STEP + Math.abs(dz) * DECK.width,
      d: Math.abs(dz) * OBSTACLE_STEP + Math.abs(dx) * DECK.width,
      h: Math.max(deckHeightAt(route, u - OBSTACLE_STEP / 2), deckHeightAt(route, u + OBSTACLE_STEP / 2)) + DECK.parapet,
    })
  }
  return boxes
}
