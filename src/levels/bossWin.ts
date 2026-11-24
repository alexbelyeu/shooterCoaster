/**
 * A boss win ends the run early (#961): once the boss is beaten and nothing is left to shoot or still to come, the
 * defeat's sting and fireworks play out for `BOSS_WIN_HOLD_SECONDS` and the results follow, through the timer's own end.
 * Nothing scorable is skipped, so scores, `maxScore` and stars are untouched.
 */
import { RUN_SECONDS } from './pacing'

/** Game seconds from the clear to the results: the boss's defeat sting and fireworks. */
export const BOSS_WIN_HOLD_SECONDS = 3

/**
 * Whether the run has nothing left once its boss is beaten: no enemy left to kill (`enemies`, the spawner's remaining
 * count, waves still to arrive included), no golden balloon still up and no wave still due (`nextWaveDue`, null once
 * every wave is in, a hard-route wave the run skipped included).
 */
export function nothingLeft(bossBeaten: boolean, enemies: number, golden: number, waveDue: number | null): boolean {
  return bossBeaten && enemies <= 0 && golden <= 0 && waveDue === null
}

/** Level time a run cleared at `clearedAt` ends at, or null when the timer would end it first (cleared in its last seconds). */
export function bossWinEndsAt(clearedAt: number, runSeconds = RUN_SECONDS): number | null {
  const at = clearedAt + BOSS_WIN_HOLD_SECONDS
  return at < runSeconds ? at : null
}
