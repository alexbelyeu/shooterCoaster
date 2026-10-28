/** Combo tiers and the 5× slow-mo envelope; pure, so keep React / three / store imports out. */

export interface ComboTier {
  minCount: number
  multiplier: number
  /** Game-time seconds (`core/gameClock.ts`) after a kill in which the next one keeps the chain. */
  windowS: number
}

export const COMBO_TIERS: readonly ComboTier[] = [
  { minCount: 1, multiplier: 1, windowS: 2.0 },
  { minCount: 4, multiplier: 2, windowS: 1.8 },
  { minCount: 8, multiplier: 3, windowS: 1.6 },
  { minCount: 15, multiplier: 5, windowS: 1.4 },
]

export const TOP_TIER = COMBO_TIERS.length - 1

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

export function comboExpired(count: number, lastKillTime: number, now: number): boolean {
  return count > 0 && now - lastKillTime >= comboWindowS(count)
}

/** Slow-mo on entering the top tier. Seconds are real (playing) time, not game time. */
export const FRENZY = {
  durationS: 1.5,
  timeScale: 0.35,
  easeS: 0.3,
  /** From one frenzy's start to the earliest next one. */
  cooldownS: 10,
} as const

const smoothstep = (x: number): number => x * x * (3 - 2 * x)

export function frenzyTimeScale(t: number): number {
  const { durationS, timeScale, easeS } = FRENZY
  if (!(t > 0) || t >= durationS) return 1
  const depth = smoothstep(Math.min(1, t / easeS, (durationS - t) / easeS))
  return 1 - (1 - timeScale) * depth
}
