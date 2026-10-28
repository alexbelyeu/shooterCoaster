/** `countdown`: the level is mounted and warming up behind Ready / Set / GO; the clock, spawns and input wait for `playing`. */
export type GamePhase = 'title' | 'levelSelect' | 'countdown' | 'playing' | 'paused' | 'results'

export interface ScoreEntry {
  level: string
  score: number
  maxScore: number
  stars: number
  timestamp: number
  /** Longest kill streak ever on this level. Missing on entries saved before it existed. */
  bestCombo?: number
}

export interface ComboState {
  /** Consecutive kills; fireworks and the boss reward read it as is. */
  count: number
  multiplier: number
  /** Game-time seconds (`core/gameClock.ts`) of the last kill. */
  lastKillTime: number
}
