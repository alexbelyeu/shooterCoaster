import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GamePhase, ScoreEntry, ComboState } from '@/types/game'
import { seedFromQuery } from '@/utils/rng'
import { startPhaseFor } from './startPhase'

interface GameState {
  // Phase
  phase: GamePhase
  setPhase: (phase: GamePhase) => void

  // Current level
  currentLevel: string | null
  setCurrentLevel: (level: string | null) => void

  /** Seeds this run's enemy spawns. */
  runSeed: number
  /** The one way to start or restart a level (enters `countdown`, `playing` under `?e2e=1`); seed precedence: `seed` > `?seed=` > `Date.now()`. */
  startRun: (levelId: string, seed?: number) => void

  // Score
  score: number
  addScore: (points: number) => void
  /** Resets score plus the per-run kills / shotsFired counters. */
  resetScore: () => void

  // Per-run counters (reset by resetScore)
  kills: number
  shotsFired: number
  registerShot: () => void

  // Combo
  combo: ComboState
  registerKill: () => void
  resetCombo: () => void

  // Timer
  timeRemaining: number
  setTimeRemaining: (t: number) => void

  // Enemies
  enemiesRemaining: number
  totalEnemies: number
  setEnemyCounts: (remaining: number, total: number) => void

  // Saved scores (persisted)
  savedScores: Record<string, ScoreEntry>
  saveScore: (entry: ScoreEntry) => void
  resetSavedScores: () => void

  // Time scale (for slow-mo)
  timeScale: number
  setTimeScale: (s: number) => void

  /** The mounted level's shader warm-up is done (`canvas/ShaderWarmup.tsx`); the countdown holds Ready until then. */
  sceneReady: boolean
  setSceneReady: (ready: boolean) => void

  // Level unlock
  isLevelUnlocked: (levelId: string) => boolean
}

/** Real-time window (ms, performance.now) in which the next kill extends the combo. */
export const COMBO_TIMEOUT = 2000

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
      setPhase: (phase) => set({ phase }),

      currentLevel: null,
      setCurrentLevel: (level) => set({ currentLevel: level }),

      runSeed: 0,
      startRun: (levelId, seed) =>
        set({
          score: 0,
          kills: 0,
          shotsFired: 0,
          combo: { count: 0, multiplier: 1, lastKillTime: 0 },
          currentLevel: levelId,
          runSeed: (seed ?? urlSeed() ?? Date.now()) >>> 0,
          phase: startPhaseFor(urlSearch() ?? ''),
        }),

      score: 0,
      addScore: (points) => set((s) => ({ score: s.score + points * s.combo.multiplier })),
      resetScore: () => set({ score: 0, kills: 0, shotsFired: 0 }),

      kills: 0,
      shotsFired: 0,
      registerShot: () => set((s) => ({ shotsFired: s.shotsFired + 1 })),

      combo: { count: 0, multiplier: 1, lastKillTime: 0 },
      registerKill: () =>
        set((s) => {
          const now = performance.now()
          const isCombo = now - s.combo.lastKillTime < COMBO_TIMEOUT
          const count = isCombo ? s.combo.count + 1 : 1
          const multiplier = Math.min(1 + (count - 1) * 0.25, 4) // max 4x
          return { kills: s.kills + 1, combo: { count, multiplier, lastKillTime: now } }
        }),
      resetCombo: () => set({ combo: { count: 0, multiplier: 1, lastKillTime: 0 } }),

      timeRemaining: 0,
      setTimeRemaining: (t) => set({ timeRemaining: t }),

      enemiesRemaining: 0,
      totalEnemies: 0,
      setEnemyCounts: (remaining, total) => set({ enemiesRemaining: remaining, totalEnemies: total }),

      timeScale: 1,
      setTimeScale: (s) => set({ timeScale: s }),

      sceneReady: false,
      setSceneReady: (ready) => set({ sceneReady: ready }),

      savedScores: {},
      saveScore: (entry) =>
        set((s) => {
          const existing = s.savedScores[entry.level]
          if (!existing || entry.score > existing.score) {
            return { savedScores: { ...s.savedScores, [entry.level]: entry } }
          }
          return {}
        }),
      resetSavedScores: () => set({ savedScores: {} }),

      isLevelUnlocked: (levelId) => {
        const state = get()
        if (levelId === 'level1') return true
        // Level N is unlocked if level N-1 has at least 1 star
        const prevNum = parseInt(levelId.replace('level', '')) - 1
        const prevId = `level${prevNum}`
        const prevScore = state.savedScores[prevId]
        return prevScore ? prevScore.stars >= 1 : false
      },
    }),
    {
      name: 'shootercoaster-scores',
      partialize: (state) => ({ savedScores: state.savedScores }),
    },
  ),
)
