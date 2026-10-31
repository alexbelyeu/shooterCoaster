import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GamePhase, ScoreEntry, ComboState, BossHud } from '@/types/game'
import { seedFromQuery } from '@/utils/rng'
import { gameTime } from '@/core/gameClock'
import { markStartup } from '@/core/startupMarks'
import { comboExpired, comboMultiplier } from '@/combat/comboTiers'
import { startPhaseFor } from './startPhase'
import { dailySeed, extendStreak, pruneDaily, type DailyStreak } from '@/levels/daily'

/** How a run was started: the campaign, or the Daily Run of a UTC day (`levels/daily.ts`). */
export type RunMode = { mode: 'campaign' } | { mode: 'daily'; dateKey: string }

const CAMPAIGN: RunMode = { mode: 'campaign' }

interface GameState {
  phase: GamePhase
  /** Also ends a resume countdown. */
  setPhase: (phase: GamePhase) => void
  /** Still `paused` through the resume Ready / GO (`ui/hud/Countdown` sets `playing` on GO), so nothing moves until then. */
  resuming: boolean
  resume: () => void

  currentLevel: string | null

  /** Seeds this run's enemy spawns. */
  runSeed: number
  /** Bumped by every `startRun`: per-run state resets on it, never on a phase change (paused → playing can be a Restart). */
  runId: number
  runMode: RunMode
  /**
   * The one way to start a level (enters `countdown`, `playing` under `?e2e=1`); seed precedence:
   * `seed` > `?seed=` > the daily seed of `mode.dateKey` (daily runs) > `Date.now()`.
   */
  startRun: (levelId: string, seed?: number, mode?: RunMode) => void
  /** Restarts the current level in the same mode: a daily keeps its seed, a campaign run gets a fresh one. */
  restartRun: () => void

  score: number
  addScore: (points: number) => void

  kills: number
  shotsFired: number
  /** Bullets that hit an enemy (`processHit`). */
  hits: number
  bestCombo: number
  registerShot: () => void
  registerHit: () => void

  // Combo (tiers and windows: combat/comboTiers.ts; expiry and slow-mo: combat/comboRuntime.ts)
  combo: ComboState
  /** Call before `addScore`, so the kill scores at the tier it reaches. */
  registerKill: () => void
  resetCombo: () => void

  timeRemaining: number
  setTimeRemaining: (t: number) => void

  enemiesRemaining: number
  totalEnemies: number
  setEnemyCounts: (remaining: number, total: number) => void

  /** The live boss, for the HUD; null when none is up. */
  boss: BossHud | null
  setBoss: (boss: BossHud | null) => void

  savedScores: Record<string, ScoreEntry>
  /** Keeps the higher score's entry; `bestCombo` is kept at its max across runs either way. */
  saveScore: (entry: ScoreEntry) => void
  resetSavedScores: () => void

  /** Best daily run per UTC day (`YYYY-MM-DD`), the last `DAILY_KEEP_DAYS` only; never touches `savedScores`. */
  savedDaily: Record<string, ScoreEntry>
  dailyStreak: DailyStreak
  /** Keeps the higher score of the day and extends the streak. */
  saveDailyScore: (entry: ScoreEntry, dateKey: string) => void

  timeScale: number
  setTimeScale: (s: number) => void

  /** The mounted level's shader warm-up is done (`canvas/ShaderWarmup.tsx`); the countdown holds Ready until then. */
  sceneReady: boolean
  setSceneReady: (ready: boolean) => void

  isLevelUnlocked: (levelId: string) => boolean
}

const NO_COMBO: ComboState = { count: 0, multiplier: 1, lastKillTime: 0 }
/** The per-run state a fresh store and every `startRun` begin from. */
const FRESH_RUN = {
  score: 0,
  kills: 0,
  shotsFired: 0,
  hits: 0,
  bestCombo: 0,
  combo: NO_COMBO,
  timeScale: 1,
  boss: null,
} satisfies Partial<GameState>

const urlSearch = (): string | null =>
  typeof window !== 'undefined' && window.location ? window.location.search : null

function urlSeed(): number | null {
  const search = urlSearch()
  return search === null ? null : seedFromQuery(search)
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      phase: 'title',
      setPhase: (phase) => set({ phase, resuming: false }),
      resuming: false,
      resume: () => set((s) => (s.phase === 'paused' ? { resuming: true } : {})),

      ...FRESH_RUN,
      currentLevel: null,

      runSeed: 0,
      runId: 0,
      runMode: CAMPAIGN,
      startRun: (levelId, seed, mode = CAMPAIGN) => {
        markStartup('runStart')
        const fallback = mode.mode === 'daily' ? dailySeed(mode.dateKey) : Date.now()
        set((s) => ({
          ...FRESH_RUN,
          currentLevel: levelId,
          runSeed: (seed ?? urlSeed() ?? fallback) >>> 0,
          runMode: mode,
          runId: s.runId + 1,
          phase: startPhaseFor(urlSearch() ?? ''),
          resuming: false,
        }))
      },
      restartRun: () => {
        const { currentLevel, runMode, runSeed, startRun } = get()
        if (!currentLevel) return
        startRun(currentLevel, runMode.mode === 'daily' ? runSeed : undefined, runMode)
      },

      addScore: (points) => set((s) => ({ score: s.score + points * s.combo.multiplier })),
      registerShot: () => set((s) => ({ shotsFired: s.shotsFired + 1 })),
      registerHit: () => set((s) => ({ hits: s.hits + 1 })),

      registerKill: () =>
        set((s) => {
          const now = gameTime()
          const { count: prev, lastKillTime } = s.combo
          const count = comboExpired(prev, lastKillTime, now) ? 1 : prev + 1
          return {
            kills: s.kills + 1,
            bestCombo: Math.max(s.bestCombo, count),
            combo: { count, multiplier: comboMultiplier(count), lastKillTime: now },
          }
        }),
      resetCombo: () => set({ combo: NO_COMBO }),

      timeRemaining: 0,
      setTimeRemaining: (t) => set({ timeRemaining: t }),

      enemiesRemaining: 0,
      totalEnemies: 0,
      setEnemyCounts: (remaining, total) => set({ enemiesRemaining: remaining, totalEnemies: total }),

      setTimeScale: (s) => set({ timeScale: s }),

      setBoss: (boss) => set({ boss }),

      sceneReady: false,
      setSceneReady: (ready) => set({ sceneReady: ready }),

      savedScores: {},
      saveScore: (entry) =>
        set((s) => {
          const existing = s.savedScores[entry.level]
          const bestCombo = Math.max(existing?.bestCombo ?? 0, entry.bestCombo ?? 0)
          if (!existing || entry.score > existing.score) {
            return { savedScores: { ...s.savedScores, [entry.level]: { ...entry, bestCombo } } }
          }
          if (bestCombo > (existing.bestCombo ?? 0)) {
            return { savedScores: { ...s.savedScores, [entry.level]: { ...existing, bestCombo } } }
          }
          return {}
        }),
      resetSavedScores: () => set({ savedScores: {} }),

      savedDaily: {},
      dailyStreak: { count: 0, lastKey: null },
      saveDailyScore: (entry, dateKey) =>
        set((s) => {
          const existing = s.savedDaily[dateKey]
          const best = existing && existing.score >= entry.score ? existing : entry
          return {
            savedDaily: pruneDaily({ ...s.savedDaily, [dateKey]: best }, dateKey),
            dailyStreak: extendStreak(s.dailyStreak, dateKey),
          }
        }),

      isLevelUnlocked: (levelId) => {
        const state = get()
        if (levelId === 'level1') return true
        const prevNum = parseInt(levelId.replace('level', '')) - 1
        const prevId = `level${prevNum}`
        const prevScore = state.savedScores[prevId]
        return prevScore ? prevScore.stars >= 1 : false
      },
    }),
    {
      name: 'shootercoaster-scores',
      partialize: (state) => ({
        savedScores: state.savedScores,
        savedDaily: state.savedDaily,
        dailyStreak: state.dailyStreak,
      }),
    },
  ),
)
