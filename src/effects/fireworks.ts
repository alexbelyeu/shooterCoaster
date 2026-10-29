/** Combo-streak fireworks (#182): numbers, launch rules and burst patterns for `Fireworks.tsx`. Pure, for Node tests. */

/** A launch past this many live rockets steals the oldest slot. */
export const MAX_ROCKETS = 3
export const SPARKS_PER_BURST = 90
/** Fainter copies of each spark a little behind it in time, so sparks read as streaks. */
export const SPARK_GHOSTS = 2
export const GHOST_LAG_S = 0.05
export const TRAIL_POINTS = 10
export const TRAIL_LAG_S = 0.035
export const POINTS_PER_SLOT = SPARKS_PER_BURST * (1 + SPARK_GHOSTS) + TRAIL_POINTS

/** Rocket flight, game seconds. */
export const FLIGHT_S = 1.1
export const STREAK_STEP = 5
/** From this streak on, two go up at once. */
export const DOUBLE_FROM = 15
/** The second rocket of a pair: launch delay, sideways spread of the pair (world units). */
export const PAIR_DELAY_S = 0.3
export const PAIR_SIDE = 90

/** Burst point: this far along the view and up the view from the camera, so it lands in frame. */
export const BURST_AHEAD = 320
export const BURST_UP = 80
/** With no launch pad ahead of the rider, rockets rise from this far below their burst. */
export const FALLBACK_RISE = 260
export const MAX_PAD_REACH = 900

export const BURST_TRAUMA = 0.2
export const BURST_TRAUMA_MS = 260
/** e2e holdFeedback: bursts stop ageing this long after they pop (sparks spread, still bright). */
export const HOLD_BURST_AGE_S = 0.45

export type BurstPattern = 'peony' | 'ring' | 'willow'
export const PATTERN_ORDER: readonly BurstPattern[] = ['peony', 'ring', 'willow']

export interface PatternSpec {
  /** Spark launch speed, world units / s (±`spread` fraction). */
  speed: number
  spread: number
  /** Velocity lost per second: v(t) = v0·e^(−drag·t). */
  drag: number
  /** Downward acceleration, world units / s². */
  gravity: number
  lifeS: number
  /** Spark diameter, world units. */
  size: number
  /** 0..1: late-life crackle flicker. */
  twinkle: number
}

export const PATTERNS: Record<BurstPattern, PatternSpec> = {
  peony: { speed: 150, spread: 0.08, drag: 1.8, gravity: 14, lifeS: 1.7, size: 5.5, twinkle: 0.2 },
  ring: { speed: 165, spread: 0.03, drag: 1.9, gravity: 10, lifeS: 1.5, size: 5.5, twinkle: 0 },
  willow: { speed: 110, spread: 0.2, drag: 1.1, gravity: 30, lifeS: 2.6, size: 4.5, twinkle: 1 },
}

/** Main + accent pairs from the Theme Park `PALETTE` (`parkSpec.ts`); willow is always gold. */
export const BURST_COLORS: readonly [string, string][] = [
  ['#ff4444', '#ffaa00'],
  ['#4488ff', '#ff44ff'],
  ['#44cc44', '#ffaa00'],
  ['#ff44ff', '#4488ff'],
  ['#ff7a2e', '#ff4444'],
]
export const WILLOW_COLORS: [string, string] = ['#ffcc55', '#ff7a2e']

/** Rockets to launch for a kill that made the streak `combo` (0 for most kills). */
export function rocketsForStreak(combo: number): number {
  if (!Number.isInteger(combo) || combo < STREAK_STEP || combo % STREAK_STEP !== 0) return 0
  return combo >= DOUBLE_FROM ? 2 : 1
}

/** Seconds from launch until the burst has faded. */
export function slotLifetime(pattern: BurstPattern): number {
  return FLIGHT_S + PATTERNS[pattern].lifeS
}

export interface Vec3 {
  x: number
  y: number
  z: number
}

/** Offset of a spark `t` seconds after the burst (drag, then gravity); mirrored in the `Fireworks.tsx` vertex shader. */
export function sparkOffset(v: Vec3, spec: Pick<PatternSpec, 'drag' | 'gravity'>, t: number, out: Vec3): Vec3 {
  const k = spec.drag
  const s = t <= 0 ? 0 : (1 - Math.exp(-k * t)) / k
  out.x = v.x * s
  out.y = v.y * s - 0.5 * spec.gravity * t * t
  out.z = v.z * s
  return out
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

/** `SPARKS_PER_BURST` spark velocities into `out` at `offset`: a Fibonacci sphere, or for `ring` a circle around `normal` (the view direction, so it faces the rider). */
export function burstVelocities(
  pattern: BurstPattern,
  rng: () => number,
  normal: Vec3,
  out: Float32Array,
  offset = 0,
): Float32Array {
  const spec = PATTERNS[pattern]
  const n = SPARKS_PER_BURST
  if (pattern === 'ring') {
    const nl = Math.hypot(normal.x, normal.y, normal.z) || 1
    const nx = normal.x / nl, ny = normal.y / nl, nz = normal.z / nl
    // (a, b) span the plane: a = up × n, with x for up when n is nearly vertical.
    const ux = Math.abs(ny) > 0.9 ? 1 : 0
    const uy = Math.abs(ny) > 0.9 ? 0 : 1
    let ax = uy * nz, ay = -ux * nz, az = ux * ny - uy * nx
    const al = Math.hypot(ax, ay, az)
    ax /= al; ay /= al; az /= al
    const bx = ny * az - nz * ay, by = nz * ax - nx * az, bz = nx * ay - ny * ax
    const twist = rng() * Math.PI * 2
    for (let i = 0; i < n; i++) {
      const th = twist + (i / n) * Math.PI * 2
      const sp = spec.speed * (1 + (rng() * 2 - 1) * spec.spread)
      const c = Math.cos(th) * sp, s = Math.sin(th) * sp
      const j = offset + i * 3
      out[j] = ax * c + bx * s
      out[j + 1] = ay * c + by * s
      out[j + 2] = az * c + bz * s
    }
    return out
  }
  const twist = rng() * Math.PI * 2
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n
    const r = Math.sqrt(1 - y * y)
    const th = twist + i * GOLDEN_ANGLE
    const sp = spec.speed * (1 + (rng() * 2 - 1) * spec.spread)
    const j = offset + i * 3
    out[j] = Math.cos(th) * r * sp
    out[j + 1] = y * sp
    out[j + 2] = Math.sin(th) * r * sp
  }
  return out
}

/** Index of the pad nearest `burst` (horizontally, within `MAX_PAD_REACH`) that is ahead of the rider, or -1. */
export function pickPad(pads: readonly Vec3[], burst: Vec3, camPos: Vec3, forward: Vec3): number {
  const fl = Math.hypot(forward.x, forward.z) || 1
  const fx = forward.x / fl, fz = forward.z / fl
  let best = -1
  let bestD = MAX_PAD_REACH
  for (let i = 0; i < pads.length; i++) {
    const p = pads[i]
    if ((p.x - camPos.x) * fx + (p.z - camPos.z) * fz <= 0) continue
    const d = Math.hypot(p.x - burst.x, p.z - burst.z)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

/** Bus events: launch `(flightS, timeScale)` as a rocket leaves its pad, burst (no payload). */
export const FIREWORK_LAUNCH_EVENT = 'firework:launch'
export const FIREWORK_BURST_EVENT = 'firework:burst'
