/**
 * Rotation-only camera trauma (#65). Never translate the camera for feedback: the
 * rails sit right under it, so any offset makes the world jump. Pure, for Node tests.
 */

export type ScreenShakeLevel = 'off' | 'reduced' | 'full'

export const SCREEN_SHAKE_LEVELS: readonly ScreenShakeLevel[] = ['off', 'reduced', 'full']

export const SCREEN_SHAKE_SCALE: Record<ScreenShakeLevel, number> = {
  off: 0,
  reduced: 0.5,
  full: 1,
}

/** Game-ms for a kill's trauma of 1 to decay to 0. */
export const KILL_TRAUMA_MS = 240
/** Kills at this combo or above give full trauma. */
export const KILL_TRAUMA_COMBO_CAP = 10
/** Peak angles at trauma 1 on 'full' (degrees). */
export const MAX_PITCH_YAW_DEG = 0.6
export const MAX_ROLL_DEG = 1
/** Noise frequency (Hz): a few smooth wobbles over a kill's decay, not a buzz. */
export const SHAKE_NOISE_HZ = 14

const DEG = Math.PI / 180

/** 0.55 at combo 1 up to 1 at the cap. */
export function killTrauma(combo: number): number {
  const c = Math.min(Math.max(Number.isFinite(combo) ? combo : 1, 1), KILL_TRAUMA_COMBO_CAP)
  return 0.55 + 0.45 * ((c - 1) / (KILL_TRAUMA_COMBO_CAP - 1))
}

/** Bus event for world-event shake: `eventBus.emit(CAMERA_TRAUMA_EVENT, amount, durationMs)`. */
export const CAMERA_TRAUMA_EVENT = 'camera:trauma'

export interface TraumaState {
  trauma: number
  /** Game-ms for a trauma of 1 to decay to 0. */
  decayMs: number
}

/**
 * Overlapping sources keep the stronger level and the later end time, so a kill
 * during a long eruption rumble neither stacks past 1 nor cuts the rumble short.
 */
export function addTrauma(state: TraumaState, amount: number, durationMs = KILL_TRAUMA_MS): TraumaState {
  const a = Math.min(Math.max(Number.isFinite(amount) ? amount : 0, 0), 1)
  const d = Math.max(1, Number.isFinite(durationMs) ? durationMs : KILL_TRAUMA_MS)
  const remainingMs = Math.max(state.trauma * state.decayMs, a * d)
  state.trauma = Math.max(state.trauma, a)
  state.decayMs = state.trauma > 0 ? remainingMs / state.trauma : KILL_TRAUMA_MS
  return state
}

export function decayTrauma(state: TraumaState, dtMs: number): TraumaState {
  state.trauma = Math.max(0, state.trauma - dtMs / state.decayMs)
  return state
}

export function effectiveShakeScale(level: ScreenShakeLevel, prefersReducedMotion: boolean): number {
  if (prefersReducedMotion) return 0
  return SCREEN_SHAKE_SCALE[level] ?? SCREEN_SHAKE_SCALE.reduced
}

/** Integer hash -> [-1, 1]. */
function hash1(n: number): number {
  let h = (n | 0) * 374761393
  h = (h ^ (h >>> 13)) * 1274126177
  h ^= h >>> 16
  return ((h >>> 0) / 4294967295) * 2 - 1
}

/** Smooth 1D value noise in [-1, 1] (quintic-interpolated lattice). */
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

/** Amplitude follows trauma² (punchy start, soft tail) times the settings scale. */
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
