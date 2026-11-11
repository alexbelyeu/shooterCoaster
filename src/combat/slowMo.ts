/**
 * The one writer of the store's `timeScale` and `frenzy` stage. Callers request a slow-mo (the 5× frenzy from
 * `comboRuntime`, the last kill from `EnemySpawner`) or set the override (the debug freeze, e2e `setTimeScale`);
 * `slowMoScale` picks the winner. `GameTimer` ticks it on playing frames, so a pause holds every envelope.
 */
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

/** Beats every envelope until cleared with null. */
export function setTimeScaleOverride(scale: number | null): void {
  override = scale
  apply()
}

export function timeScaleOverride(): number | null {
  return override
}

export function tickSlowMo(delta: number): void {
  // e2e holdFeedback: hold the frenzy's full slow-down and its flash for the screenshot.
  if (frenzyT < FRENZY.durationS && isFeedbackHeld())
    frenzyT = Math.min(Math.max(frenzyT, FRENZY.easeS), FRENZY.durationS - FRENZY.easeS)
  else frenzyT += delta
  lastKillT += delta
  apply()
}

/**
 * `tickSlowMo` runs only on playing frames, so a run that ends mid-envelope hands the time scale back here.
 * An override stays unless `dropOverride` (the level unmounting).
 */
export function endSlowMo(dropOverride = false): void {
  frenzyT = Infinity
  lastKillT = Infinity
  if (dropOverride) override = null
  apply()
}

/** A new run (`runId`): nothing running, no override. Writes nothing, `startRun` already reset the store. */
export function resetSlowMo(): void {
  frenzyT = Infinity
  lastKillT = Infinity
  override = null
}
