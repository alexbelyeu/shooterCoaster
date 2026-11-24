import type { ArcTable } from '@/track/arcLength'
import { buildTrackIndex, type TrackIndex } from '@/levels/environments/shared/trackClearance'
import { createRng, type Rng } from '@/utils/rng'
import { LANDMARK_SITE, RIDE_TOWERS, SPIRE_HEIGHT, STREET_GRID } from './config'
import { HIGHWAY, highwayObstacles, nearHighway } from './highwayLayout'

/**
 * Neon Metropolis's city plan (#323), pure and seeded: towers on a street grid, kept off the track and its support
 * towers; a skyline ring of taller silhouettes beyond; neon signs on the faces of the towers that look onto the ride.
 * The street grid (`STREET_GRID`) is the one the asphalt shader paints, so the towers stand on blocks, never in a road.
 * The ride runs down the streets' centre lines (#871), so the towers either side stand `TRACK_CLEARANCE` off the rails:
 * close at speed. The ride's own towers (`RIDE_TOWERS`: the lift's, the first drop's) stand where the ride needs them.
 */

/** A box tower standing on the ground at (x, z): footprint `w` × `d`, `h` tall, axis-aligned to the grid. */
export interface Tower {
  x: number
  z: number
  w: number
  d: number
  h: number
}

export type NeonColor = 'magenta' | 'cyan' | 'amber'

/** A neon slab: centre, size (along x, y, z before the yaw) and the yaw that turns it onto its tower's face. */
export interface NeonSign {
  x: number
  y: number
  z: number
  w: number
  h: number
  d: number
  yaw: number
  color: NeonColor
}

export interface CityLayout {
  towers: Tower[]
  skyline: Tower[]
  signs: NeonSign[]
}

/** The towers fill blocks out to this many track extents; the skyline ring stands beyond. */
export const CITY_REACH = 2.1
const SKYLINE = { inner: 2500, outer: 3300, count: 64 } as const
/** No tower this near the hero tower's centre. */
const HERO_CLEARANCE = 380
/** Clearance from the track's ground projection to a tower's footprint: a street's centre line clears its towers. */
export const TRACK_CLEARANCE = 30
/** Clearance from the track's ground projection to a neon blade's outer edge: shorter blades where the ride is close. */
const SIGN_CLEARANCE = 20
/** The shortest blade worth hanging. */
const MIN_BLADE = 8
/** Clearance from the elevated highway's deck (`highwayLayout.ts`) to a tower's corner. */
const HIGHWAY_CLEARANCE = 8
/** Towers within this of the track carry signs. */
const SIGN_REACH = 420
const NEON: readonly NeonColor[] = ['magenta', 'cyan', 'magenta', 'cyan', 'amber']

/** Four height classes: low blocks, mid-rises, towers and a few spires taller than the ride's crest. */
function towerHeight(rng: Rng): number {
  const r = rng()
  if (r < 0.35) return rng.range(60, 120)
  if (r < 0.72) return rng.range(120, 220)
  if (r < 0.94) return rng.range(220, 340)
  return rng.range(340, 480)
}

/** Distance in XZ from (x, z) to the footprint of `t`, 0 inside it. */
export function footprintDistance(t: Pick<Tower, 'x' | 'z' | 'w' | 'd'>, x: number, z: number): number {
  return Math.hypot(Math.max(Math.abs(x - t.x) - t.w / 2, 0), Math.max(Math.abs(z - t.z) - t.d / 2, 0))
}

/** Whether every track sample stands `clearance` off the footprint of `t`. */
function clearOfTrack(table: ArcTable, index: TrackIndex, t: Pick<Tower, 'x' | 'z' | 'w' | 'd'>, clearance: number): boolean {
  const reach = Math.hypot(t.w, t.d) / 2 + clearance
  if (!index.near(t.x, t.z, reach)) return true
  for (let i = 0; i < table.count; i++) if (footprintDistance(t, table.x[i], table.z[i]) < clearance) return false
  return true
}

function nearestTrackPoint(table: ArcTable, x: number, z: number): { x: number; z: number; dist: number } {
  let best = Infinity
  let bx = 0
  let bz = 0
  for (let i = 0; i < table.count; i += 4) {
    const d = (table.x[i] - x) ** 2 + (table.z[i] - z) ** 2
    if (d < best) {
      best = d
      bx = table.x[i]
      bz = table.z[i]
    }
  }
  return { x: bx, z: bz, dist: Math.sqrt(best) }
}

/**
 * Signs on the face of `t` that looks towards (tx, tz), the nearest track point `dist` from its centre: a vertical blade at
 * one corner (shortened to keep `SIGN_CLEARANCE` off the track), sometimes a band across it.
 */
function signsFor(t: Tower, tx: number, tz: number, dist: number, rng: Rng, out: NeonSign[]): void {
  const dx = tx - t.x
  const dz = tz - t.z
  // The face's outward normal (nx, nz), its half-width along the face and half-depth to it
  const alongX = Math.abs(dx) * t.d > Math.abs(dz) * t.w
  const nx = alongX ? Math.sign(dx) : 0
  const nz = alongX ? 0 : Math.sign(dz)
  const half = alongX ? t.d / 2 : t.w / 2
  const reach = alongX ? t.w / 2 : t.d / 2
  // Yaw turns a slab's local +z onto the face normal; its local x then runs along the face
  const yaw = Math.atan2(nx, nz)
  const side = rng() < 0.5 ? -1 : 1
  // Along-face unit vector (local +x after the yaw)
  const ax = nz
  const az = -nx
  const color = NEON[Math.floor(rng() * NEON.length)]
  const bladeH = Math.min(110, t.h * rng.range(0.3, 0.5))
  const bladeY = rng.range(Math.max(bladeH / 2 + 12, t.h * 0.3), t.h - bladeH / 2 - 4)
  const blade = { w: 3, d: Math.min(26, dist - reach - SIGN_CLEARANCE) }
  const edge = half - 6
  if (blade.d >= MIN_BLADE) out.push({
    x: t.x + nx * (reach + blade.d / 2) + ax * side * edge,
    y: bladeY,
    z: t.z + nz * (reach + blade.d / 2) + az * side * edge,
    w: blade.w,
    h: bladeH,
    d: blade.d,
    yaw,
    color,
  })
  if (rng() < 0.6) {
    const bandW = half * 2 * rng.range(0.5, 0.85)
    out.push({
      x: t.x + nx * (reach + 1.5),
      y: rng.range(t.h * 0.45, t.h - 10),
      z: t.z + nz * (reach + 1.5),
      w: bandW,
      h: rng.range(8, 16),
      d: 2,
      yaw,
      color: NEON[Math.floor(rng() * NEON.length)],
    })
  }
}

/** Seeded: the same city on every visit. `extent` is the track's reach (`trackExtent`). */
export function layoutCity(track: ArcTable, extent: number, seed = 7323): CityLayout {
  const rng = createRng(seed)
  const index = buildTrackIndex(track)
  const towers: Tower[] = []
  const signs: NeonSign[] = []
  for (const t of RIDE_TOWERS) {
    towers.push({ ...t })
    const near = nearestTrackPoint(track, t.x, t.z)
    signsFor(t, near.x, near.z, near.dist, rng, signs)
  }
  const { pitch, street } = STREET_GRID
  const lot = (pitch - street) / 2
  const reach = extent * CITY_REACH
  const n = Math.ceil(reach / pitch)
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      // Each block holds one big tower or up to four on its lots
      const cx = i * pitch
      const cz = j * pitch
      if (Math.hypot(cx, cz) > reach) continue
      const lots = rng() < 0.3 ? [{ x: cx, z: cz, size: pitch - street }] : [-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ x: cx + (sx * lot) / 2, z: cz + (sz * lot) / 2, size: lot })))
      for (const l of lots) {
        if (rng() < 0.12) continue
        const w = l.size * rng.range(0.7, 0.95)
        const d = l.size * rng.range(0.7, 0.95)
        const t = { x: l.x, z: l.z, w, d, h: towerHeight(rng) }
        if (!clearOfTrack(track, index, t, TRACK_CLEARANCE)) continue
        if (Math.hypot(l.x - LANDMARK_SITE.x, l.z - LANDMARK_SITE.z) < HERO_CLEARANCE) continue
        if (nearHighway(HIGHWAY, t.x, t.z, Math.hypot(t.w, t.d) / 2 + HIGHWAY_CLEARANCE)) continue
        if (RIDE_TOWERS.some((r) => Math.abs(r.x - t.x) < (r.w + t.w) / 2 && Math.abs(r.z - t.z) < (r.d + t.d) / 2)) continue
        towers.push(t)
        const near = nearestTrackPoint(track, t.x, t.z)
        if (near.dist < SIGN_REACH && rng() < 0.75) signsFor(t, near.x, near.z, near.dist, rng, signs)
      }
    }
  }
  const skyline: Tower[] = []
  // Beyond the last block, however far the ride reaches
  const inner = Math.max(SKYLINE.inner, reach + pitch / 2)
  for (let k = 0; k < SKYLINE.count; k++) {
    const a = ((k + rng.range(0.1, 0.9)) / SKYLINE.count) * Math.PI * 2
    const r = rng.range(inner, inner + SKYLINE.outer - SKYLINE.inner)
    // The hero tower (`Features.tsx`) stands alone in the ring
    if (Math.hypot(Math.cos(a) * r - LANDMARK_SITE.x, Math.sin(a) * r - LANDMARK_SITE.z) < HERO_CLEARANCE) continue
    skyline.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, w: rng.range(110, 220), d: rng.range(110, 220), h: rng.range(320, 720) })
  }
  return { towers, skyline, signs }
}

/** The hero tower's tiers, widest first: each stands on the one below. */
const TIERS = [
  { w: 260, h: 0.42 },
  { w: 190, h: 0.28 },
  { w: 120, h: 0.18 },
] as const
const NEEDLE = { w: 10, h: SPIRE_HEIGHT * 0.12 }
const CROWN = { h: 7, d: 4 }

export function layoutHeroTower(): { tiers: Tower[]; neon: NeonSign[] } {
  const tiers: Tower[] = []
  const neon: NeonSign[] = []
  let base = 0
  for (const [i, t] of TIERS.entries()) {
    const h = SPIRE_HEIGHT * t.h
    tiers.push({ x: LANDMARK_SITE.x, z: LANDMARK_SITE.z, w: t.w, d: t.w, h: base + h })
    base += h
    // A neon crown round the top of each tier, magenta and cyan in turn
    const color = i % 2 === 0 ? 'magenta' : 'cyan'
    for (const side of [0, 1, 2, 3]) {
      const yaw = (side * Math.PI) / 2
      const out = t.w / 2 + CROWN.d / 2
      neon.push({
        x: LANDMARK_SITE.x + Math.sin(yaw) * out,
        y: base - CROWN.h,
        z: LANDMARK_SITE.z + Math.cos(yaw) * out,
        w: t.w + CROWN.d * 2,
        h: CROWN.h,
        d: CROWN.d,
        yaw,
        color,
      })
    }
  }
  neon.push({ x: LANDMARK_SITE.x, y: base + NEEDLE.h / 2, z: LANDMARK_SITE.z, w: NEEDLE.w, h: NEEDLE.h, d: NEEDLE.w, yaw: 0, color: 'amber' })
  return { tiers, neon }
}

/** Every tower standing on the blocks: the blocks', the skyline and the hero tower's tiers (the traffic drives between them). */
export function streetTowers(layout: Pick<CityLayout, 'towers' | 'skyline'>): Tower[] {
  return [...layout.towers, ...layout.skyline, ...layoutHeroTower().tiers]
}

/** Every tower an air enemy must stay out of: the street towers and the elevated highway. */
export function cityTowers(track: ArcTable, extent: number): Tower[] {
  return [...streetTowers(layoutCity(track, extent)), ...highwayObstacles(HIGHWAY)]
}

/** How far an air enemy's centre must stay from a tower's faces (x, z) and above its roof (y). */
export interface Clearance {
  x: number
  y: number
  z: number
}

interface Point {
  x: number
  y: number
  z: number
}

function clearOf(towers: readonly Tower[], p: Point, ground: number, c: Clearance): boolean {
  const up = p.y - ground - c.y
  return towers.every((t) => up >= t.h || Math.abs(p.x - t.x) >= t.w / 2 + c.x || Math.abs(p.z - t.z) >= t.d / 2 + c.z)
}

/** Street centre lines tried either way of a spot, along each axis. */
const STREETS_TRIED = 3

/**
 * Calls `visit` with `p` moved across onto each street within `reach` either way of it, along x and along z, each of
 * `offsets` off the street's centre line (`STREET_GRID`: those lines lie at odd multiples of half the pitch).
 */
function acrossStreets(p: Point, reach: number, offsets: readonly number[], visit: (q: Point) => void): void {
  const { pitch } = STREET_GRID
  for (const alongX of [true, false]) {
    const nearest = Math.round((alongX ? p.z : p.x) / pitch - 0.5)
    for (let k = -reach; k <= reach; k++) {
      for (const offset of offsets) {
        const across = (nearest + k + 0.5) * pitch + offset
        visit(alongX ? { x: p.x, y: p.y, z: across } : { x: across, y: p.y, z: p.z })
      }
    }
  }
}

/**
 * Of the spots `offerAll` offers, the one the most of `eyesSeeing(spot)` see past the towers (`sight` over the spot,
 * `ground` the street's height), the nearest `p` of equals; `p` when it offers none.
 */
function mostSeen(
  towers: readonly Tower[],
  p: Point,
  ground: number,
  sight: number,
  eyesSeeing: (q: Point) => Point[],
  offerAll: (offer: (q: Point) => void) => void,
): Point {
  let best = p
  let bestSeen = -1
  let bestDist = Infinity
  offerAll((q) => {
    const seen = eyesSeeing(q).filter((eye) => !hidden(towers, eye, q, ground, sight)).length
    const dist = Math.hypot(q.x - p.x, q.z - p.z)
    if (seen > bestSeen || (seen === bestSeen && dist < bestDist)) [best, bestSeen, bestDist] = [q, seen, dist]
  })
  return best
}

/**
 * The spot clear of every tower that the most of `eyesSeeing(spot)` see past the towers, the nearest of equals: `p`
 * itself, or `p` moved across onto the centre line of a nearby street, along x or along z. Placed by the nearest open
 * spot alone, a formation's drones sat in the cross streets beside the ride's avenue, behind its towers (#871, #950).
 * `ground` is the ground's height under `p`; `p` when nothing in reach is clear.
 */
export function clearOfTowers(
  towers: readonly Tower[],
  p: Point,
  ground: number,
  c: Clearance,
  eyesSeeing: (q: Point) => Point[] = () => [],
): Point {
  return mostSeen(towers, p, ground, 0, eyesSeeing, (offer) => {
    const ifClear = (q: Point) => {
      if (clearOf(towers, q, ground, c)) offer(q)
    }
    ifClear(p)
    acrossStreets(p, STREETS_TRIED, [0], ifClear)
  })
}

/** How far off a street's centre line a ground enemy stands: past the traffic lanes, on the pavement's edge (#963). */
export const KERB_OFFSET = 22
/** A pavement spot stays this far from the rails and their towers, as the traffic does (`trafficPaths.ts`). */
const PAVEMENT_TRACK_CLEARANCE = 44
/**
 * The passes over the kerbs: the rail clearance and how many streets out either way. Where the rails take every kerb on
 * the nearest streets (the helix round the hero tower, #871), the second looks a street further, still clear of the car
 * and the supports' feet.
 */
const PAVEMENT_PASSES: readonly (readonly [number, number])[] = [[PAVEMENT_TRACK_CLEARANCE, 1], [30, 2]]
const PAVEMENT_TOWER_CLEARANCE = 12
const KERBS = [-KERB_OFFSET, KERB_OFFSET]

/** Height over its foot of the bot's face, the point a tower must not hide from the rider. */
const FACE_HEIGHT = 25

/** Whether a tower stands across the line from `eye` to `sight` over `q` (`ground` the street's height): the line's lowest point over its footprint is under its roof. */
function hidden(towers: readonly Tower[], eye: Point, q: Point, ground: number, sight: number): boolean {
  const dx = q.x - eye.x
  const dy = q.y + sight - eye.y
  const dz = q.z - eye.z
  // The slab test: where the line enters and leaves the tower's footprint (a zero d divides to ±Infinity, as it should)
  return towers.some((t) => {
    const ax = (t.x - t.w / 2 - eye.x) / dx
    const bx = (t.x + t.w / 2 - eye.x) / dx
    const az = (t.z - t.d / 2 - eye.z) / dz
    const bz = (t.z + t.d / 2 - eye.z) / dz
    const t0 = Math.max(0, Math.min(ax, bx), Math.min(az, bz))
    const t1 = Math.min(1, Math.max(ax, bx), Math.max(az, bz))
    return t0 < t1 && eye.y + dy * (dy < 0 ? t1 : t0) - ground < t.h
  })
}

/**
 * The kerb spot on the nearest streets either way of a ground enemy's `p`, clear of the rails and every tower, that
 * the most of the approach's looks see past the towers (`eyesSeeing`: the eyes whose cone holds a spot, #963); the
 * nearest of equals; `PAVEMENT_PASSES` widens the search where the rails take every kerb in reach. Else `p`, which the
 * trackside placement already put clear of the rails.
 */
export function onPavement(towers: readonly Tower[], index: TrackIndex, p: Point, eyesSeeing: (q: Point) => Point[] = () => []): Point {
  const clearance = { x: PAVEMENT_TOWER_CLEARANCE, y: 0, z: PAVEMENT_TOWER_CLEARANCE }
  for (const [rails, reach] of PAVEMENT_PASSES) {
    const best = mostSeen(towers, p, p.y, FACE_HEIGHT, eyesSeeing, (offer) =>
      acrossStreets(p, reach, KERBS, (q) => {
        if (!index.near(q.x, q.z, rails) && clearOf(towers, q, p.y, clearance)) offer(q)
      }),
    )
    if (best !== p) return best
  }
  return p
}

/** Which way the street under a spot runs (the one along x where two cross); null inside a block. */
export function streetAxis(x: number, z: number): 'x' | 'z' | null {
  const { pitch, street } = STREET_GRID
  const offLine = (c: number) => Math.abs(((c / pitch - 0.5) % 1 + 1.5) % 1 - 0.5) * pitch
  if (offLine(z) <= street / 2) return 'x'
  if (offLine(x) <= street / 2) return 'z'
  return null
}
