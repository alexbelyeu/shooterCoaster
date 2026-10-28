/**
 * Combo tier table and slow-mo envelope (pure; no React, three or store imports).
 * Windows are game-time seconds (`core/gameClock.ts`): pause and slow-mo stretch them.
 */

export interface ComboTier {
  /** Consecutive kills that reach this tier. */
  minCount: number
  multiplier: number
  /** Game-time seconds after a kill in which the next one keeps the chain. */
  windowS: number
}

export const COMBO_TIERS: readonly ComboTier[] = [
  { minCount: 1, multiplier: 1, windowS: 2.0 },
  { minCount: 4, multiplier: 2, windowS: 1.8 },
  { minCount: 8, multiplier: 3, windowS: 1.6 },
  { minCount: 15, multiplier: 5, windowS: 1.4 },
]

export const TOP_TIER = COMBO_TIERS.length - 1

/** 0 (1×) … 3 (5×). A count of 0 is tier 0. */
export function comboTierIndex(count: number): number {
  for (let i = TOP_TIER; i > 0; i--) if (count >= COMBO_TIERS[i].minCount) return i
  return 0
}

export function comboMultiplier(count: number): number {
  return COMBO_TIERS[comboTierIndex(count)].multiplier
}

export function comboWindowS(count: number): number {
  return COMBO_TIERS[comboTierIndex(count)].windowS
}

/** True once the chain of `count` kills, the last at `lastKillTime`, can no longer be extended at `now`. */
export function comboExpired(count: number, lastKillTime: number, now: number): boolean {
  return count > 0 && now - lastKillTime >= comboWindowS(count)
}

/** Slow-mo on entering the top tier. Seconds are real (playing) time, not game time. */
export const FRENZY = {
  durationS: 1.5,
  timeScale: 0.35,
  /** Ease in at the start and out at the end. */
  easeS: 0.3,
  /** From one frenzy's start to the earliest next one. */
  cooldownS: 10,
} as const

const smoothstep = (x: number): number => x * x * (3 - 2 * x)

/** Time scale `t` seconds into a frenzy: 1 → 0.35 → 1, eased; 1 outside [0, durationS]. */
export function frenzyTimeScale(t: number): number {
  const { durationS, timeScale, easeS } = FRENZY
  if (!(t > 0) || t >= durationS) return 1
  const depth = smoothstep(Math.min(1, t / easeS, (durationS - t) / easeS))
  return 1 - (1 - timeScale) * depth
}
