/**
 * Phone haptics (#995): the buzz for a kill, a boss weak-point hit and a boss defeat, and the
 * rules for when one plays. Pure: `useHaptics` reads the gates and calls `navigator.vibrate`.
 */

export type HapticEvent = 'kill' | 'weakPoint' | 'defeat'

/** `navigator.vibrate` patterns (ms on, off, on…): kill shortest, defeat longest. Constants, so a call allocates nothing. */
export const HAPTIC_PATTERNS: Readonly<Record<HapticEvent, number | readonly number[]>> = {
  kill: 12,
  weakPoint: 28,
  defeat: [70, 50, 160],
}

/** Which event wins a clash: a stronger one cuts a weaker one short, never the other way round. */
const RANK: Readonly<Record<HapticEvent, number>> = { kill: 0, weakPoint: 1, defeat: 2 }

/** The least time between two buzzes, so a multi-kill reads as one tap rather than a queued drone. */
export const HAPTIC_MIN_GAP_MS = 90

function patternMs(pattern: number | readonly number[]): number {
  if (typeof pattern === 'number') return pattern
  let total = 0
  for (const ms of pattern) total += ms
  return total
}

export interface HapticGates {
  /** The Settings "Vibration" toggle. */
  enabled: boolean
  /** OS or in-game reduced motion. */
  reducedMotion: boolean
  /** `navigator.vibrate` exists (not desktop Safari / Firefox, not iOS). */
  canVibrate: boolean
}

export interface HapticState {
  /** Until when (ms) the last buzz holds the motor. */
  busyUntil: number
  /** That buzz's rank. */
  rank: number
}

export function createHapticState(): HapticState {
  return { busyUntil: -Infinity, rank: -1 }
}

/**
 * The pattern to play for `event` at `now` (ms), or null: gated off, or a buzz of equal or higher
 * rank still holds the motor. Records the buzz it returns in `state`.
 */
export function hapticFor(state: HapticState, event: HapticEvent, now: number, gates: HapticGates): number | readonly number[] | null {
  if (!gates.enabled || gates.reducedMotion || !gates.canVibrate) return null
  const rank = RANK[event]
  if (now < state.busyUntil && rank <= state.rank) return null
  const pattern = HAPTIC_PATTERNS[event]
  state.busyUntil = now + Math.max(patternMs(pattern), HAPTIC_MIN_GAP_MS)
  state.rank = rank
  return pattern
}
