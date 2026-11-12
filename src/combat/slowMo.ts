/** The one writer of the store's `timeScale` and `frenzy` stage; ticked by `GameTimer` on playing frames, so a pause holds it. */
import { useGameStore } from '@/store/useGameStore'
import { FRENZY, frenzyStage, slowMoScale } from './comboTiers'
import { isFeedbackHeld } from './hitFeedback'

/** Real playing seconds since each envelope started; Infinity when it isn't running. */
let frenzyT = Infinity
let lastKillT = Infinity
let override: number | null = null

function apply(): void {
  const timeScale = slowMoScale(override, frenzyT, lastKillT)
  const frenzy = frenzyStage(frenzyT)
  const store = useGameStore.getState()
  if (store.timeScale !== timeScale || store.frenzy !== frenzy) store.setSlowMo(timeScale, frenzy)
}

export function requestSlowMo(kind: 'frenzy' | 'lastKill'): void {
  if (kind === 'frenzy') frenzyT = 0
  else lastKillT = 0
  apply()
}

/** The debug freeze and e2e `setTimeScale`; null hands time back to the envelopes. */
export function setTimeScaleOverride(scale: number | null): void {
  override = scale
  apply()
}

export function timeScaleOverride(): number | null {
  return override
}

export function tickSlowMo(delta: number): void {
  // e2e holdFeedback holds the frenzy deep, flash on, for the screenshot.
  if (frenzyT < FRENZY.durationS && isFeedbackHeld())
    frenzyT = Math.min(Math.max(frenzyT, FRENZY.easeS), FRENZY.durationS - FRENZY.easeS)
  else frenzyT += delta
  lastKillT += delta
  apply()
}

/** A run ending mid-envelope never reaches another tick; the override survives unless the level unmounts. */
export function endSlowMo(dropOverride = false): void {
  frenzyT = Infinity
  lastKillT = Infinity
  if (dropOverride) override = null
  apply()
}

/** Writes nothing: `startRun` already reset the store. */
export function resetSlowMo(): void {
  frenzyT = Infinity
  lastKillT = Infinity
  override = null
}
