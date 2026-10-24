/** `countdown`: the level is mounted and warming up behind Ready / Set / GO; the clock, spawns and input wait for `playing`. */
export type GamePhase = 'title' | 'levelSelect' | 'countdown' | 'playing' | 'paused' | 'results'

export interface ScoreEntry {
  level: string
  score: number
  maxScore: number
  stars: number
  timestamp: number
}

export interface ComboState {
  count: number
  multiplier: number
  lastKillTime: number
}
