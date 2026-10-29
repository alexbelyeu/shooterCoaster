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
  count: number
  multiplier: number
  /** Game-time seconds (`core/gameClock.ts`) of the last kill. */
  lastKillTime: number
}

/** The boss bar's view of a live boss (`entities/bosses/BossBase.tsx` writes it). */
export interface BossHud {
  name: string
  /** Hp left / total per weak point, in spec order: one bar segment each. */
  hp: readonly number[]
  maxHp: readonly number[]
  defeated: boolean
}
