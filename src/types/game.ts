export type GamePhase = 'title' | 'levelSelect' | 'playing' | 'paused' | 'results'

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
