/**
 * Per-frame combo upkeep, ticked by `GameTimer` on playing frames: advances the game
 * clock, breaks a chain whose window lapsed (`combo:broken`), and runs the top-tier
 * slow-mo (`combo:frenzy`) through the store's `timeScale`.
 *
 * Events:
 *   'combo:broken' — { count, tier }, when a chain of tier ≥ 1 (2× or more) lapses.
 *   'combo:frenzy' — { count }, on entering the top tier (5×) outside the cooldown.
 */
import { useGameStore } from '@/store/useGameStore'
import { eventBus } from '@/core/EventBus'
import { advanceGameTime, gameTime, resetGameTime } from '@/core/gameClock'
import { FRENZY, TOP_TIER, comboExpired, comboTierIndex, frenzyTimeScale } from './comboTiers'
import { isFeedbackHeld } from './hitFeedback'

export interface ComboBrokenEvent {
  count: number
  tier: number
}

let prevTier = 0
/** Real playing seconds since this run's last frenzy started; Infinity before the first. */
let sinceFrenzy = Infinity
/** The time scale the frenzy last wrote, or null when it isn't running. */
let written: number | null = null

const brokenEvent: ComboBrokenEvent = { count: 0, tier: 0 }
const frenzyEvent = { count: 0 }

/** Call when a run starts: clears the game clock and any frenzy. */
export function resetComboRuntime(): void {
  resetGameTime()
  prevTier = 0
  sinceFrenzy = Infinity
  written = null
}

/** True while the frenzy slow-mo owns `timeScale`. */
export function frenzyActive(): boolean {
  return written !== null
}

/** One playing frame of `delta` real seconds (timeScale > 0). */
export function tickCombo(delta: number): void {
  const store = useGameStore.getState()

  // Before the clock moves: a kill since the last frame that entered the top tier counts even if the chain lapses this frame.
  const { count, lastKillTime } = store.combo
  const tier = comboTierIndex(count)
  if (tier === TOP_TIER && prevTier < TOP_TIER && sinceFrenzy >= FRENZY.cooldownS) {
    sinceFrenzy = 0
    written = 1
    frenzyEvent.count = count
    eventBus.emit('combo:frenzy', frenzyEvent)
  }
  prevTier = tier

  advanceGameTime(delta * store.timeScale)
  if (comboExpired(count, lastKillTime, gameTime())) {
    store.resetCombo()
    if (tier >= 1) {
      brokenEvent.count = count
      brokenEvent.tier = tier
      eventBus.emit('combo:broken', brokenEvent)
    }
  }

  if (written === null) {
    sinceFrenzy += delta
    return
  }
  // Someone else set the time scale (the last-kill slow-mo, a test freeze): theirs wins.
  if (store.timeScale !== written) {
    written = null
    sinceFrenzy += delta
    return
  }
  // e2e holdFeedback: hold the full slow-down for the screenshot.
  if (isFeedbackHeld()) sinceFrenzy = Math.min(Math.max(sinceFrenzy, FRENZY.easeS), FRENZY.durationS - FRENZY.easeS)
  else sinceFrenzy += delta
  const scale = frenzyTimeScale(sinceFrenzy)
  written = sinceFrenzy >= FRENZY.durationS ? null : scale
  if (store.timeScale !== scale) store.setTimeScale(scale)
}
