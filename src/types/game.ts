/**
 * A run opens with `loading` (the level chunk, its scene, the shader warm-up and the audio, behind the loading screen),
 * then `intro` (the fixed-length tour of the level into the seat, #674, #675), then `countdown` (Ready / Set / GO in the seat); the clock,
 * spawns and input wait for `playing`.
 */
export type GamePhase = 'title' | 'levelSelect' | 'loading' | 'intro' | 'countdown' | 'playing' | 'paused' | 'results'

/**
 * How a run was started: the campaign, the Daily Run of a UTC day (`levels/daily.ts`), or a Boss Rush stage
 * (`levels/bossRush.ts`, #1011): `stage` is its index in `rushStages`, `seconds` the level seconds of the stages behind
 * it (on the results, the whole rush's).
 */
export type RunMode = { mode: 'campaign' } | { mode: 'daily'; dateKey: string } | { mode: 'bossRush'; stage: number; seconds: number }

/** A campaign run's look (#829): the level as built, or its Night Ride (`levels/environments/nightPreset.ts`). */
export type RideVariant = 'day' | 'night'

/** Which screen started a run (`level_start`'s `from`): title PLAY, a level select card, the results screen or the pause menu. */
export type RunFrom = 'title' | 'select' | 'results' | 'pause'

export interface ScoreEntry {
  level: string
  score: number
  maxScore: number
  stars: number
  timestamp: number
  /** Longest kill streak ever on this level. Missing on entries saved before it existed. */
  bestCombo?: number
}

/** One row of a level's local top 10 (`store/leaderboard.ts`). */
export interface LeaderboardEntry {
  /** Three letters A-Z, or `---` for a best carried over from before the leaderboard. */
  initials: string
  score: number
  stars: number
  /** Epoch ms of the run; identifies the entry. */
  date: number
  /** `'60s'` for a run under the 60 s rules (#452); missing on a run from before them (`store/leaderboard.ts` `RULESET`). */
  ruleset?: '60s'
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
