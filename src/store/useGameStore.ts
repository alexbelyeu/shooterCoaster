import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GamePhase, ScoreEntry, ComboState, BossHud } from '@/types/game'
import { seedFromQuery } from '@/utils/rng'
import { gameTime } from '@/core/gameClock'
import { comboExpired, comboMultiplier } from '@/combat/comboTiers'
import { startPhaseFor } from './startPhase'

interface GameState {
  // Phase
  phase: GamePhase
  /** Also ends a resume countdown. */
  setPhase: (phase: GamePhase) => void
  /** Still `paused` through the resume Ready / GO (`ui/hud/Countdown` sets `playing` on GO), so nothing moves until then. */
  resuming: boolean
  resume: () => void

  // Current level
  currentLevel: string | null
  setCurrentLevel: (level: string | null) => void

  /** Seeds this run's enemy spawns. */
  runSeed: number
  /** Bumped by every `startRun`: per-run state resets on it, never on a phase change (paused → playing can be a Restart). */
  runId: number
  /** The one way to start or restart a level (enters `countdown`, `playing` under `?e2e=1`); seed precedence: `seed` > `?seed=` > `Date.now()`. */
  startRun: (levelId: string, seed?: number) => void

  // Score
  score: number
  addScore: (points: number) => void
  resetScore: () => void

  // Per-run counters (reset by resetScore / startRun)
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

  // Timer
  timeRemaining: number
  setTimeRemaining: (t: number) => void

  // Enemies
  enemiesRemaining: number
  totalEnemies: number
  setEnemyCounts: (remaining: number, total: number) => void

  /** The live boss, for the HUD; null when none is up. */
  boss: BossHud | null
  setBoss: (boss: BossHud | null) => void

  // Saved scores (persisted)
  savedScores: Record<string, ScoreEntry>
  /** Keeps the higher score's entry; `bestCombo` is kept at its max across runs either way. */
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

const RUN_COUNTERS = { score: 0, kills: 0, shotsFired: 0, hits: 0, bestCombo: 0 } as const
const NO_COMBO: ComboState = { count: 0, multiplier: 1, lastKillTime: 0 }

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

      currentLevel: null,
      setCurrentLevel: (level) => set({ currentLevel: level }),

      runSeed: 0,
      runId: 0,
      startRun: (levelId, seed) =>
        set((s) => ({
          ...RUN_COUNTERS,
          combo: NO_COMBO,
          timeScale: 1,
          boss: null,
          currentLevel: levelId,
          runSeed: (seed ?? urlSeed() ?? Date.now()) >>> 0,
          runId: s.runId + 1,
          phase: startPhaseFor(urlSearch() ?? ''),
          resuming: false,
        })),

      score: 0,
      addScore: (points) => set((s) => ({ score: s.score + points * s.combo.multiplier })),
      resetScore: () => set(RUN_COUNTERS),

      kills: 0,
      shotsFired: 0,
      hits: 0,
      bestCombo: 0,
      registerShot: () => set((s) => ({ shotsFired: s.shotsFired + 1 })),
      registerHit: () => set((s) => ({ hits: s.hits + 1 })),

      combo: NO_COMBO,
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

      timeScale: 1,
      setTimeScale: (s) => set({ timeScale: s }),

      boss: null,
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
