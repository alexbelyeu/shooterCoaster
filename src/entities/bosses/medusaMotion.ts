/**
 * The Medusa of the Starr's motion, pure and allocation-free per frame. Root-local frame: the origin at the star's hub,
 * +z out of the star towards the hall (the rider), y up. She rises out of the hub, leans out for her second phase and
 * laughs and sinks back on defeat; each snake grows from a slot in her curls, sways, rears and strikes at the camera.
 */

import { GYM_SCALE, STAR, toWorld } from '@/levels/environments/biomes/gym/blockout'

type V3 = readonly [number, number, number]

/** The star's front at its hub (world): her root's origin before she rises out. */
export const MEDUSA_HUB: V3 = (() => {
  const c = toWorld(STAR.centre)
  const proud = STAR.depth * GYM_SCALE + 2
  return [c.x + STAR.facing.x * proud, c.y, c.z + STAR.facing.z * proud]
})()

/** How far she turns her head and shoulders towards the rider, either way (radians). */
export const MEDUSA_MAX_YAW = 0.35

export const MEDUSA_BODY = {
  /**
   * Out from the star's front to her root at full rise. With `MEDUSA_RISE.leanOut` it keeps her bust off the ride's
   * last stretch, which turns round in the pit in front of her (`gymTrack.test.ts` checks the clearance).
   */
  out: 35,
  /** Head centre (its sphere is about 80 across, the curls reach ~140 out). */
  head: [0, 40, 0] as V3,
} as const

export const MEDUSA_RISE = {
  riseS: 1.6,
  /** Where she starts, inside the hub: down and back into the wall, and small. */
  from: [0, -110, -170] as V3,
  fromScale: 0.3,
  /** The second phase: this much further out, pitched this far forwards. */
  leanOut: 25,
  leanPitch: 0.16,
  leanS: 0.8,
} as const

export interface Ellipsoid {
  at: V3
  radii: V3
}

/** Her bust's solid shapes, root-local: `MEDUSA_BODY_GEO` draws the first three, the last bounds her curls. */
export const MEDUSA_BUST = {
  shoulders: { at: [0, -92, -5], radii: [138, 52, 62] },
  gown: { at: [0, -150, 0], radii: [132, 72, 68] },
  head: { at: [0, 40, 0], radii: [66, 80, 68] },
  curls: { at: [0, 54, -12], radii: [113, 117, 105] },
} as const satisfies Record<string, Ellipsoid>

/** Her turn towards a point `side` across and `out` in front of the hub (root-local x / z), clamped to `MEDUSA_MAX_YAW`. */
export function yawToward(x: number, z: number): number {
  return Math.max(-MEDUSA_MAX_YAW, Math.min(MEDUSA_MAX_YAW, Math.atan2(x, z)))
}

/**
 * The smallest of `p`'s (root-local) distances from each bust shape grown by `margin`, in units of that shape's
 * radii: under 1 is inside one.
 */
export function bustClearance(p: V3, margin: number): number {
  let min = Infinity
  for (const { at, radii } of Object.values(MEDUSA_BUST)) {
    const d = Math.hypot((p[0] - at[0]) / (radii[0] + margin), (p[1] - at[1]) / (radii[1] + margin), (p[2] - at[2]) / (radii[2] + margin))
    if (d < min) min = d
  }
  return min
}

export const MEDUSA_DEFEAT = {
  laughS: 1.3,
  sinkS: 1.5,
} as const

export const SNAKE = {
  segments: 8,
  /** Seconds a snake takes to uncoil out of the curls when its phase begins. */
  emergeS: 0.6,
  /** A destroyed snake's stub: this much of its length, curled back into the hair. */
  stub: 0.22,
  /** Of its length: how far the head rears up over its root, sways sideways, rears back before a strike and reaches in one. */
  rear: 0.42,
  sway: 0.16,
  windup: 0.3,
  reach: 1.25,
  swayHz: 1.3,
  /** One strike cycle in fractions of its period: coiled and swaying, rearing back, the strike, held out, recoiling. */
  windupAt: 0.5,
  strikeAt: 0.72,
  holdAt: 0.8,
  recoilAt: 0.88,
} as const

export interface SnakeSlot {
  /** Where it grows from the curls. */
  root: V3
  /** Unit direction it grows in. */
  out: V3
  length: number
  /** Body radius at the root (it tapers to `0.4×` at the head). */
  radius: number
  phase: number
  /** Seconds per strike, and where in its cycle it starts, so the snakes take turns. */
  period: number
  offset: number
}

const norm = (x: number, y: number, z: number): V3 => {
  const l = Math.hypot(x, y, z)
  return [x / l, y / l, z / l]
}

const slot = (root: V3, out: V3, phase: number, period: number, offset: number, length = 120, radius = 17): SnakeSlot => ({
  root, out: norm(...out), length, radius, phase, period, offset,
})

/** Four from the sides of her curls first, four more (faster) from below and above them, then the crown snake. */
export const SNAKE_SLOTS: readonly SnakeSlot[] = [
  slot([95, 75, 15], [0.85, 0.45, 0.35], 0, 3, 0),
  slot([-95, 75, 15], [-0.85, 0.45, 0.35], 0, 3, 1.5),
  slot([62, 135, 10], [0.5, 0.8, 0.35], 0, 3, 0.75),
  slot([-62, 135, 10], [-0.5, 0.8, 0.35], 0, 3, 2.25),
  slot([112, 15, 0], [0.95, 0.05, 0.35], 1, 2.2, 0.3),
  slot([-112, 15, 0], [-0.95, 0.05, 0.35], 1, 2.2, 1.4),
  slot([30, 158, 0], [0.3, 0.9, 0.3], 1, 2.2, 0.85),
  slot([-30, 158, 0], [-0.3, 0.9, 0.3], 1, 2.2, 1.95),
  slot([0, 172, -5], [0, 0.35, 0.95], 2, 2.6, 0.6, 130, 25),
]

export const smooth01 = (x: number): number => {
  const t = Math.min(1, Math.max(0, x))
  return t * t * (3 - 2 * t)
}

/** 0 inside the hub → 1 risen. */
export function riseAmount(age: number): number {
  return smooth01(age / MEDUSA_RISE.riseS)
}

/** 0 while she fights → 1 sunk back into the star, after her laugh. */
export function defeatSink(sinceDefeat: number): number {
  return sinceDefeat < 0 ? 0 : smooth01((sinceDefeat - MEDUSA_DEFEAT.laughS) / MEDUSA_DEFEAT.sinkS)
}

/** Her laugh: a shake of the shoulders that fades out over `laughS`, 0 while she fights. */
export function laughShake(sinceDefeat: number): number {
  if (sinceDefeat < 0 || sinceDefeat > MEDUSA_DEFEAT.laughS) return 0
  return Math.sin(sinceDefeat * 34) * (1 - sinceDefeat / MEDUSA_DEFEAT.laughS)
}

/** Root-local placement: rise, lean (0..1) and sink folded into an offset and a scale. */
export function bodyPlacement(age: number, lean: number, sinceDefeat: number, out: { y: number; z: number; scale: number; pitch: number }) {
  const r = riseAmount(age) * (1 - defeatSink(sinceDefeat))
  const [, fy, fz] = MEDUSA_RISE.from
  out.y = fy - fy * r
  out.z = MEDUSA_BODY.out * r + fz * (1 - r) + MEDUSA_RISE.leanOut * lean * r
  out.scale = MEDUSA_RISE.fromScale + (1 - MEDUSA_RISE.fromScale) * r
  out.pitch = MEDUSA_RISE.leanPitch * lean - (sinceDefeat >= 0 ? 0.35 * smooth01(sinceDefeat / 0.3) * (1 - defeatSink(sinceDefeat)) : 0)
}

/** Its strike cycle at `t` seconds: −windup..0 rearing back, 0..1 the strike out towards the camera. */
export function strikePose(s: SnakeSlot, t: number): number {
  const f = ((((t + s.offset) / s.period) % 1) + 1) % 1
  const { windupAt, strikeAt, holdAt, recoilAt, windup } = SNAKE
  if (f < windupAt) return 0
  if (f < strikeAt) return -windup * smooth01((f - windupAt) / (strikeAt - windupAt))
  if (f < holdAt) return -windup + (1 + windup) * smooth01((f - strikeAt) / (holdAt - strikeAt))
  if (f < recoilAt) return 1
  return 1 - smooth01((f - recoilAt) / (1 - recoilAt))
}

/** True when the strike lands (reaches full reach) between game seconds `t0` and `t1`. */
export function strikeLandsBetween(s: SnakeSlot, t0: number, t1: number): boolean {
  if (t1 <= t0) return false
  const land = SNAKE.holdAt * s.period - s.offset
  const n = Math.ceil((t0 - land) / s.period)
  const at = land + n * s.period
  return at > t0 && at <= t1
}

/** How far out of the curls the snake is: its phase's emergence, or its stub once destroyed. */
export function snakeLength(s: SnakeSlot, phaseStarted: number | null, age: number, alive: boolean): number {
  if (!alive) return SNAKE.stub
  if (phaseStarted === null) return 0
  return smooth01((age - phaseStarted) / SNAKE.emergeS)
}

/** Radius of segment boundary `k` (0 at the root, `SNAKE.segments` at the head). */
export function snakeRadius(s: SnakeSlot, k: number): number {
  return s.radius * (1 - 0.6 * (k / SNAKE.segments))
}

/**
 * Lays the snake's centreline into `points` (`SNAKE.segments + 1` xyz triples, root-local), a quadratic curve from its
 * root out along `out` to its head: rearing over the root, swaying, then struck along `dir` (unit, towards the camera).
 * `grown` 0..1 scales it about its root; a dead stub (`alive` false) hooks back into the hair.
 */
export function laySnake(s: SnakeSlot, t: number, grown: number, alive: boolean, dir: V3, points: Float32Array): void {
  const L = s.length * grown
  const [rx, ry, rz] = s.root
  const [ox, oy, oz] = s.out
  const sway = Math.sin(t * SNAKE.swayHz * 2 * Math.PI + s.offset * 2.1) * SNAKE.sway
  // Sideways for the sway: out × up (or x when it grows straight up).
  let sx = -oz
  let sz = ox
  const sl = Math.hypot(sx, sz)
  if (sl < 1e-3) {
    sx = 1
    sz = 0
  } else {
    sx /= sl
    sz /= sl
  }
  const strike = alive ? strikePose(s, t) : 0
  const curl = alive ? 0 : -0.6
  // Control point: out along its growth; head: reared up and swayed, then thrown along `dir`.
  const cx = rx + ox * L * 0.6
  const cy = ry + oy * L * 0.6
  const cz = rz + oz * L * 0.6
  const reach = strike * SNAKE.reach * L
  const hx = rx + ox * L * 0.7 + sx * sway * L + dir[0] * reach
  const hy = ry + oy * L * 0.7 + (SNAKE.rear + curl) * L + dir[1] * reach
  const hz = rz + oz * L * 0.7 + sz * sway * L + dir[2] * reach + curl * L * 0.5
  const n = SNAKE.segments
  for (let k = 0; k <= n; k++) {
    const u = k / n
    const a = (1 - u) * (1 - u)
    const b = 2 * u * (1 - u)
    const c = u * u
    // A slither: a small wave along the body, out of phase with the sway.
    const wave = Math.sin(u * Math.PI * 2 - t * 5 + s.offset) * 0.06 * L * u * (1 - u) * 4
    points[k * 3] = a * rx + b * cx + c * hx + sx * wave
    points[k * 3 + 1] = a * ry + b * cy + c * hy
    points[k * 3 + 2] = a * rz + b * cz + c * hz + sz * wave
  }
}
