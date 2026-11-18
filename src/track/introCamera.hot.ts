/**
 * The level's opening swoop and the results orbit (#328). Through Ready / Set the camera comes down from high over
 * the level's hero landmark into the coaster seat, landing on the ride camera's start pose as GO fires; behind the
 * results it circles the landmark. `CoasterCamera` plays both and never moves the camera off the ride in `playing`.
 */
import type { Vec3Like } from './cameraRig.hot'
import type { PlacementBounds } from '@/entities/spawning/spawnPlacement'

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
}

/** Swoop path in world units × trackScale: the start's reach toward the landmark and height over the seat. */
const LEAD = 360
const RISE = 140
/** The last stretch comes down into the seat from this far behind it. */
const BACK = 70
/** The landmark sits this far (radians) under the centre of the view, below the countdown's words. */
const LANDMARK_DIP = 12 * (Math.PI / 180)
/** Share of the swoop spent looking at the landmark before the view turns onto the track. */
const LOOK_HOLD = 0.35
/** Peak bank (radians) into the turn, at mid-swoop. */
const SWOOP_BANK = 7 * (Math.PI / 180)

/** Before Set the swoop eases toward this share of its path (Ready can wait on the warm-up for a while). */
export const READY_HOLD = 0.4
const READY_RATE = 1.3

/** Orbit: a turn a minute, kept this far over the ground under the camera. */
export const ORBIT_RATE = (2 * Math.PI) / 60
const ORBIT_CLEARANCE = 40

export interface SwoopClock {
  progress: number
  /** progress per second on the last frame. */
  velocity: number
  /** Landing (Set → GO): its length (0 = not landing yet), start and starting slope over it. */
  landSeconds: number
  landFrom: number
  landSlope: number
}

export function createSwoopClock(): SwoopClock {
  // eslint-disable-next-line sc/no-hot-path-alloc -- cold: once per camera mount
  return { progress: 0, velocity: 0, landSeconds: 0, landFrom: 0, landSlope: 0 }
}

export function resetSwoopClock(c: SwoopClock): void {
  c.progress = 0
  c.velocity = 0
  c.landSeconds = 0
  c.landFrom = 0
  c.landSlope = 0
}

/**
 * Advance the swoop. Until the level shows (`visible`) it waits at the start; until GO's time is known (`toGo`
 * seconds, from Set) it eases toward `READY_HOLD`; then a cubic Hermite carries it from where it is, at its speed,
 * to 1 with zero speed exactly at GO, and it holds the seat if GO comes late.
 */
export function stepSwoopClock(c: SwoopClock, dt: number, visible: boolean, toGo: number | null): number {
  if (!visible) return c.progress
  if (toGo === null) {
    if (dt > 0) {
      const next = READY_HOLD + (c.progress - READY_HOLD) * Math.exp(-dt * READY_RATE)
      c.velocity = (next - c.progress) / dt
      c.progress = next
    }
    return c.progress
  }
  if (c.landSeconds === 0) {
    if (toGo <= 0) return (c.progress = 1)
    c.landSeconds = toGo
    c.landFrom = c.progress
    // Capped at 3× the rest of the way so the Hermite never overshoots the seat.
    c.landSlope = Math.min(Math.max(c.velocity, 0) * toGo, 3 * (1 - c.progress))
  }
  const u = Math.min(Math.max(1 - toGo / c.landSeconds, 0), 1)
  const u2 = u * u
  const u3 = u2 * u
  c.progress = c.landFrom * (2 * u3 - 3 * u2 + 1) + c.landSlope * (u3 - 2 * u2 + u) + (-2 * u3 + 3 * u2)
  return c.progress
}

function clampInto(p: Vec3Like, b: PlacementBounds | undefined): void {
  if (!b) return
  p.x = Math.min(b.maxX, Math.max(b.minX, p.x))
  p.y = Math.min(b.maxY, p.y)
  p.z = Math.min(b.maxZ, Math.max(b.minZ, p.z))
}

function smoothstep(x: number): number {
  const t = Math.min(Math.max(x, 0), 1)
  return t * t * (3 - 2 * t)
}

/** Scratch control points: the swoop runs every countdown frame. */
const P0 = { x: 0, y: 0, z: 0 }
const P1 = { x: 0, y: 0, z: 0 }
const P2 = { x: 0, y: 0, z: 0 }

/**
 * The camera at swoop progress `p` (0 = high over the landmark, 1 = the seat): position into `outPos`, unit look
 * direction into `outDir`; returns the bank (radians, `rotateZ` after `lookAt`). At p = 1 it is exactly `seat` /
 * `seatDir`, the ride camera's start pose. `anchor` is the landmark's focus point; `bounds` an interior's walls.
 */
export function swoopPose(
  seat: Vec3Like,
  seatDir: Vec3Like,
  anchor: Vec3Like,
  trackScale: number,
  p: number,
  bounds: PlacementBounds | undefined,
  outPos: Vec3Like,
  outDir: Vec3Like,
): number {
  if (p >= 1) {
    outPos.x = seat.x
    outPos.y = seat.y
    outPos.z = seat.z
    outDir.x = seatDir.x
    outDir.y = seatDir.y
    outDir.z = seatDir.z
    return 0
  }
  const t = Math.max(p, 0)
  // Horizontal ride direction and direction to the landmark.
  let fx = seatDir.x
  let fz = seatDir.z
  const fl = Math.hypot(fx, fz)
  if (fl > 1e-6) {
    fx /= fl
    fz /= fl
  } else {
    fx = 1
    fz = 0
  }
  let ax = anchor.x - seat.x
  let az = anchor.z - seat.z
  const dist = Math.hypot(ax, az)
  if (dist > 1e-6) {
    ax /= dist
    az /= dist
  } else {
    ax = fx
    az = fz
  }
  const lead = Math.min(dist * 0.75, LEAD * trackScale)
  const rise = RISE * trackScale
  const back = BACK * trackScale
  P0.x = seat.x + ax * lead
  P0.y = seat.y + rise
  P0.z = seat.z + az * lead
  // Lingers over the landmark, sweeps down to behind the seat, comes in along the track.
  P1.x = P0.x + (seat.x - P0.x) * 0.25
  P1.y = P0.y + rise * 0.15
  P1.z = P0.z + (seat.z - P0.z) * 0.25
  P2.x = seat.x - fx * 2 * back
  P2.y = seat.y + back * 0.5
  P2.z = seat.z - fz * 2 * back
  clampInto(P0, bounds)
  clampInto(P1, bounds)
  clampInto(P2, bounds)
  const s = 1 - t
  const b0 = s * s * s
  const b1 = 3 * s * s * t
  const b2 = 3 * s * t * t
  const b3 = t * t * t
  outPos.x = b0 * P0.x + b1 * P1.x + b2 * P2.x + b3 * seat.x
  outPos.y = b0 * P0.y + b1 * P1.y + b2 * P2.y + b3 * seat.y
  outPos.z = b0 * P0.z + b1 * P1.z + b2 * P2.z + b3 * seat.z

  // From looking at the landmark to the ride's look, by yaw (the short way round) and pitch.
  const lx = anchor.x - outPos.x
  const ly = anchor.y - outPos.y
  const lz = anchor.z - outPos.z
  const ll = Math.hypot(lx, ly, lz) || 1
  const yawA = Math.atan2(lz, lx)
  const pitchA = Math.asin(Math.min(Math.max(ly / ll, -1), 1)) + LANDMARK_DIP
  const yawB = Math.atan2(seatDir.z, seatDir.x)
  const pitchB = Math.asin(Math.min(Math.max(seatDir.y, -1), 1))
  let dYaw = yawB - yawA
  dYaw -= Math.round(dYaw / (2 * Math.PI)) * 2 * Math.PI
  const w = smoothstep((t - LOOK_HOLD) / (1 - LOOK_HOLD))
  const yaw = yawA + dYaw * w
  const pitch = pitchA + (pitchB - pitchA) * w
  const cp = Math.cos(pitch)
  outDir.x = Math.cos(yaw) * cp
  outDir.y = Math.sin(pitch)
  outDir.z = Math.sin(yaw) * cp
  // Bank into the turn (yaw decreasing turns left, which is a positive roll).
  return -Math.sign(dYaw) * SWOOP_BANK * Math.sin(Math.PI * t)
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
  clampInto(outPos, bounds)
  outTarget.x = hero.x
  outTarget.y = groundY + hero.focus
  outTarget.z = hero.z
}
