import type { ArcTable } from '@/track/arcLength'
import { buildTrackIndex } from '@/levels/environments/shared/trackClearance'
import { createRng, type Rng } from '@/utils/rng'
import { LANDMARK_SITE, SPIRE_HEIGHT } from './config'

/**
 * Neon Metropolis's city plan (#323), pure and seeded: towers on a street grid, kept off the track and its support
 * towers; a skyline ring of taller silhouettes beyond; neon signs on the faces of the towers that look onto the ride.
 * The street grid (`STREET_GRID`) is the one the asphalt shader paints, so the towers stand on blocks, never in a road.
 */

/** Block pitch and street width (world units): the asphalt shader paints the same grid. */
export const STREET_GRID = { pitch: 240, street: 64 } as const

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
const CITY_REACH = 2.1
const SKYLINE = { inner: 2500, outer: 3300, count: 64 } as const
/** No tower this near the hero tower's centre. */
const HERO_CLEARANCE = 380
/** Clearance from the track's ground projection to a tower's corner. */
const TRACK_CLEARANCE = 30
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

/** Signs on the face of `t` that looks towards (tx, tz): a vertical blade at one corner, sometimes a band across it. */
function signsFor(t: Tower, tx: number, tz: number, rng: Rng, out: NeonSign[]): void {
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
  const blade = { w: 3, d: 26 }
  const edge = half - 6
  out.push({
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
        if (index.near(l.x, l.z, Math.hypot(w, d) / 2 + TRACK_CLEARANCE)) continue
        if (Math.hypot(l.x - LANDMARK_SITE.x, l.z - LANDMARK_SITE.z) < HERO_CLEARANCE) continue
        const t = { x: l.x, z: l.z, w, d, h: towerHeight(rng) }
        towers.push(t)
        const near = nearestTrackPoint(track, t.x, t.z)
        if (near.dist < SIGN_REACH && rng() < 0.75) signsFor(t, near.x, near.z, rng, signs)
      }
    }
  }
  const skyline: Tower[] = []
  for (let k = 0; k < SKYLINE.count; k++) {
    const a = ((k + rng.range(0.1, 0.9)) / SKYLINE.count) * Math.PI * 2
    const r = rng.range(SKYLINE.inner, SKYLINE.outer)
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

/** Every tower an air enemy must stay out of: the blocks, the skyline and the hero tower's tiers. */
export function cityTowers(track: ArcTable, extent: number): Tower[] {
  const { towers, skyline } = layoutCity(track, extent)
  return [...towers, ...skyline, ...layoutHeroTower().tiers]
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

/** Street centre lines tried for a blocked spot, nearest first. */
const STREETS_TRIED = 6

/**
 * `p` if it is `c` clear of every tower, else `p` moved across z onto the nearest centre line of a street running
 * along x that is (`STREET_GRID`: those lines lie at odd multiples of half the pitch). An air enemy whose drift is
 * wide along x and narrow across z keeps it inside that street. `ground` is the ground's height under `p`.
 */
export function clearOfTowers(towers: readonly Tower[], p: Point, ground: number, c: Clearance): Point {
  if (clearOf(towers, p, ground, c)) return p
  const { pitch } = STREET_GRID
  const at = p.z / pitch - 0.5
  const nearest = Math.round(at)
  const toward = at >= nearest ? 1 : -1
  for (let k = 0; k < STREETS_TRIED; k++) {
    // The nearest line, then the next nearest on either side in turn
    const line = nearest + toward * (k % 2 === 1 ? (k + 1) / 2 : -k / 2)
    const q = { x: p.x, y: p.y, z: (line + 0.5) * pitch }
    if (clearOf(towers, q, ground, c)) return q
  }
  return p
}
