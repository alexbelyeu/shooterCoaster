/**
 * Rotation-only camera "trauma" for the coaster camera (issue #65).
 *
 * The camera must never translate off the track pose for feedback: the rails sit
 * directly under it, so any displacement makes the world visibly jump. Instead a
 * kill adds trauma (0..1) that decays linearly to 0 within KILL_TRAUMA_MS and
 * drives small pitch / yaw / roll offsets from smooth 1D value noise.
 *
 * World events (the volcanic eruption) add trauma with a longer decay through
 * the `camera:trauma` bus event, so they obey the same Screen shake setting
 * and prefers-reduced-motion as kills.
 *
 * Pure (no React / three imports) so it is unit-tested in plain Node.
 */

export type ScreenShakeLevel = 'off' | 'reduced' | 'full'

export const SCREEN_SHAKE_LEVELS: readonly ScreenShakeLevel[] = ['off', 'reduced', 'full']

/** Amplitude multiplier per settings level. */
export const SCREEN_SHAKE_SCALE: Record<ScreenShakeLevel, number> = {
  off: 0,
  reduced: 0.5,
  full: 1,
}

/** Trauma decays from 1 to 0 in this many game-ms (combo-scaled kills decay sooner). */
export const KILL_TRAUMA_MS = 240
/** Kills at this combo or above give full trauma. */
export const KILL_TRAUMA_COMBO_CAP = 10
/** Peak angles at trauma 1 on 'full' (degrees). */
export const MAX_PITCH_YAW_DEG = 0.6
export const MAX_ROLL_DEG = 1
/** Noise lattice frequency (Hz): a few smooth wobbles over the decay, not a buzz. */
export const SHAKE_NOISE_HZ = 14

const DEG = Math.PI / 180

/** Trauma a kill adds for its combo: 0.55 at combo 1 up to 1 at the cap. */
export function killTrauma(combo: number): number {
  const c = Math.min(Math.max(Number.isFinite(combo) ? combo : 1, 1), KILL_TRAUMA_COMBO_CAP)
  return 0.55 + 0.45 * ((c - 1) / (KILL_TRAUMA_COMBO_CAP - 1))
}

/**
 * `camera:trauma` bus event: `eventBus.emit(CAMERA_TRAUMA_EVENT, amount, durationMs)`
 * adds `amount` (0..1) of trauma that takes `durationMs` game-ms to decay from 1.
 */
export const CAMERA_TRAUMA_EVENT = 'camera:trauma'

/** Live trauma: level 0..1 and the game-ms a trauma of 1 takes to decay to 0. */
export interface TraumaState {
  trauma: number
  decayMs: number
}

/**
 * Add `amount` (0..1) of trauma that decays over `durationMs`. Overlapping
 * sources keep the stronger level and the later end time, so a kill during a
 * long eruption rumble neither stacks past 1 nor cuts the rumble short.
 */
export function addTrauma(state: TraumaState, amount: number, durationMs = KILL_TRAUMA_MS): TraumaState {
  const a = Math.min(Math.max(Number.isFinite(amount) ? amount : 0, 0), 1)
  const d = Math.max(1, Number.isFinite(durationMs) ? durationMs : KILL_TRAUMA_MS)
  const remainingMs = Math.max(state.trauma * state.decayMs, a * d)
  state.trauma = Math.max(state.trauma, a)
  state.decayMs = state.trauma > 0 ? remainingMs / state.trauma : KILL_TRAUMA_MS
  return state
}

/** Linear decay: trauma 1 reaches 0 after exactly `state.decayMs`. */
export function decayTrauma(state: TraumaState, dtMs: number): TraumaState {
  state.trauma = Math.max(0, state.trauma - dtMs / state.decayMs)
  return state
}

/** Shake scale for a settings level; prefers-reduced-motion forces it off. */
export function effectiveShakeScale(level: ScreenShakeLevel, prefersReducedMotion: boolean): number {
  if (prefersReducedMotion) return 0
  return SCREEN_SHAKE_SCALE[level] ?? SCREEN_SHAKE_SCALE.reduced
}

/** Integer hash -> [-1, 1]. Deterministic, allocation-free. */
function hash1(n: number): number {
  let h = (n | 0) * 374761393
  h = (h ^ (h >>> 13)) * 1274126177
  h ^= h >>> 16
  return ((h >>> 0) / 4294967295) * 2 - 1
}

/** Smooth 1D value noise in [-1, 1] (quintic-interpolated lattice values). */
export function smoothNoise1(x: number, seed: number): number {
  const i = Math.floor(x)
  const f = x - i
  const u = f * f * f * (f * (f * 6 - 15) + 10)
  const s = (seed | 0) * 7919
  const a = hash1(i + s)
  const b = hash1(i + 1 + s)
  return a + (b - a) * u
}

export interface ShakeAngles {
  /** Radians. */
  pitch: number
  yaw: number
  roll: number
}

/**
 * Write the rotation offsets for `trauma` at game time `timeS` into `out`.
 * Amplitude follows trauma² (punchy start, soft tail) times the settings scale.
 */
export function shakeAngles(
  trauma: number,
  timeS: number,
  seed: number,
  scale: number,
  out: ShakeAngles,
): ShakeAngles {
  const t = Math.min(Math.max(trauma, 0), 1)
  const amp = t * t * Math.min(Math.max(scale, 0), 1)
  if (amp === 0) {
    out.pitch = 0
    out.yaw = 0
    out.roll = 0
    return out
  }
  const x = timeS * SHAKE_NOISE_HZ
  out.pitch = MAX_PITCH_YAW_DEG * DEG * amp * smoothNoise1(x, seed)
  out.yaw = MAX_PITCH_YAW_DEG * DEG * amp * smoothNoise1(x, seed + 101)
  out.roll = MAX_ROLL_DEG * DEG * amp * smoothNoise1(x, seed + 202)
  return out
}
