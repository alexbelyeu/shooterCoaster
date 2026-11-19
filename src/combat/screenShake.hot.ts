/**
 * Rotation-only camera trauma (#65). Never translate the camera for feedback: the
 * rails sit right under it, so any offset makes the world jump. Pure, for Node tests.
 */
import { TOP_TIER, comboTierIndex } from './comboTiers'
import { smoothNoise1 } from '@/utils/valueNoise.hot'

export type ScreenShakeLevel = 'off' | 'reduced' | 'full'

export const SCREEN_SHAKE_LEVELS: readonly ScreenShakeLevel[] = ['off', 'reduced', 'full']

export const SCREEN_SHAKE_SCALE: Record<ScreenShakeLevel, number> = {
  off: 0,
  reduced: 0.5,
  full: 1,
}

/** Game-ms for a kill's trauma of 1 to decay to 0. */
export const KILL_TRAUMA_MS = 240
/** Peak angles at trauma 1 on 'full' (degrees). */
export const MAX_PITCH_YAW_DEG = 0.6
export const MAX_ROLL_DEG = 1
/** Noise frequency (Hz): a few smooth wobbles over a kill's decay, not a buzz. */
export const SHAKE_NOISE_HZ = 14

const DEG = Math.PI / 180

/** 0.55 at the 1× tier up to 1 at 5×, a step per combo tier. */
export function killTrauma(combo: number): number {
  return 0.55 + 0.45 * (comboTierIndex(combo) / TOP_TIER)
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

/** Rail rumble (#697): a constant fine shake with the ride's speed, peak angle (degrees) at top speed on 'full'. */
export const RUMBLE_DEG = 0.15
/** A buzz of the wheels on the rail, unlike a kill's few wobbles. */
export const RUMBLE_HZ = 22

/** Amplitude follows speed^1.5 (nothing at the ride's crawl) times the settings scale; `timeS` is game time. */
export function rumbleAngles(speedNorm: number, timeS: number, scale: number, out: ShakeAngles): ShakeAngles {
  const s = Number.isFinite(speedNorm) ? Math.min(Math.max(speedNorm, 0), 1) : 0
  const amp = RUMBLE_DEG * DEG * s * Math.sqrt(s) * Math.min(Math.max(scale, 0), 1)
  const x = timeS * RUMBLE_HZ
  out.pitch = amp * smoothNoise1(x, 911)
  out.yaw = 0.5 * amp * smoothNoise1(x, 912)
  out.roll = amp * smoothNoise1(x, 913)
  return out
}
