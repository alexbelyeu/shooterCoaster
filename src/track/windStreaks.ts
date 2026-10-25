/** Wind streaks on fast sections (#27); radii and lengths are in half screen heights, so any aspect looks the same. */
import { createRng } from '@/utils/rng'

export const STREAK_COUNT = 24
/** `RigState.speedNorm` where streaks start to fade in. */
export const STREAK_SPEED_THRESHOLD = 0.7
/** Peak opacity at top speed on the 'full' Screen-shake setting. */
export const STREAK_MAX_OPACITY = 0.5
/** Streaks are born this far from the centre, so the crosshair area stays clear. */
export const STREAK_INNER_RADIUS = 0.4
/** Seconds one streak takes from birth to the screen edge at threshold speed. */
export const STREAK_LIFE_S = 0.55

const LAYOUT_SEED = 0x57a1d

export function streakOpacity(speedNorm: number, motionScale: number): number {
  if (!Number.isFinite(speedNorm) || !Number.isFinite(motionScale)) return 0
  const x = Math.min(Math.max((speedNorm - STREAK_SPEED_THRESHOLD) / (1 - STREAK_SPEED_THRESHOLD), 0), 1)
  return STREAK_MAX_OPACITY * x * x * (3 - 2 * x) * Math.min(Math.max(motionScale, 0), 1)
}

/** Streak clock rate × game time. */
export function streakRate(speedNorm: number): number {
  return Number.isFinite(speedNorm) ? 1 + Math.min(Math.max(speedNorm, 0), 1) : 1
}

/** 4 floats per streak: angle (evenly spread, jittered), phase, length, rate. */
export function streakLayout(count = STREAK_COUNT): Float32Array {
  const rng = createRng(LAYOUT_SEED)
  const out = new Float32Array(count * 4)
  for (let i = 0; i < count; i++) {
    out[i * 4] = ((i + rng.range(-0.35, 0.35)) / count) * Math.PI * 2
    out[i * 4 + 1] = rng()
    out[i * 4 + 2] = rng.range(0.18, 0.32)
    out[i * 4 + 3] = rng.range(0.8, 1.25) / STREAK_LIFE_S
  }
  return out
}
