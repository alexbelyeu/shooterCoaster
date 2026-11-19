import type { GamePhase } from '@/types/game'

export interface RunStart {
  /** The page's query string. */
  search: string
  /** The same level again with its scene loaded and warmed up: nothing left to load. */
  warm: boolean
  /** A restart (`restartRun`: Replay, R on results, Restart in the pause menu): no intro. */
  replay: boolean
}

/**
 * Phase a run starts in (#674): the loading screen, or straight to Ready / Set / GO for a restart with nothing to
 * load; under the e2e hook (`?e2e=1`, so smoke timings stay as they were) `playing`, unless `&countdown=1` asks for
 * the whole opening.
 */
export function startPhaseFor({ search, warm, replay }: RunStart): 'loading' | 'countdown' | 'playing' {
  const q = new URLSearchParams(search)
  if (q.has('e2e') && q.get('countdown') !== '1') return 'playing'
  return replay && warm ? 'countdown' : 'loading'
}

/** After the loading screen: the intro swoop, unless it is a restart or reduced motion skips it. */
export function phaseAfterLoading(skipIntro: boolean, reducedMotion: boolean): 'intro' | 'countdown' {
  return skipIntro || reducedMotion ? 'countdown' : 'intro'
}

/** A level is the current run's and the run not over: loading, intro, countdown, playing or paused. */
export const isInRun = (phase: GamePhase): boolean =>
  phase === 'loading' || phase === 'intro' || phase === 'countdown' || phase === 'playing' || phase === 'paused'

/** The level is on screen and the run going (its intro, countdown or play), not paused or still loading. */
export const isLevelActive = (phase: GamePhase): boolean => phase === 'intro' || phase === 'countdown' || phase === 'playing'
