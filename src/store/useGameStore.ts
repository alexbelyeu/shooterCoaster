import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GamePhase, ScoreEntry, ComboState, BossHud } from '@/types/game'
import { seedFromQuery } from '@/utils/rng'
import { gameTime } from '@/core/gameClock'
import { markStartup } from '@/core/startupMarks'
import { comboExpired, comboMultiplier } from '@/combat/comboTiers'
import { startPhaseFor } from './startPhase'
import { NO_PICKUP, applyPickup, type PickupWeaponId, type WeaponState } from '@/combat/weapons/weaponTypes'

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
  /** The one way to start or restart a level (enters `countdown`, `playing` under `?e2e=1`); seed precedence: `seed` > `?seed=` > `Date.now()`. */
  startRun: (levelId: string, seed?: number) => void

  score: number
  addScore: (points: number) => void

  kills: number
  shotsFired: number
  /** Bullets that hit a target (`processHit`), each once however many it pierces, so never more than `shotsFired`. */
  hits: number
  bestCombo: number
  /** One per bullet: a spread pull counts as 3 shots. */
  registerShot: (bullets?: number) => void
  registerHit: () => void

  // Combo (tiers and windows: combat/comboTiers.ts; expiry and slow-mo: combat/comboRuntime.ts)
  combo: ComboState
  /** Call before `addScore`, so the kill scores at the tier it reaches. */
  registerKill: () => void
  resetCombo: () => void

  /** The weapon pickup this run (`combat/weapons/weaponTypes.ts`). */
  weapon: WeaponState
  pickUpWeapon: (id: PickupWeaponId) => void

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
  weapon: NO_PICKUP,
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
      startRun: (levelId, seed) => {
        markStartup('runStart')
        set((s) => ({
          ...FRESH_RUN,
          currentLevel: levelId,
          runSeed: (seed ?? urlSeed() ?? Date.now()) >>> 0,
          runId: s.runId + 1,
          phase: startPhaseFor(urlSearch() ?? ''),
          resuming: false,
        }))
      },

      addScore: (points) => set((s) => ({ score: s.score + points * s.combo.multiplier })),
      registerShot: (bullets = 1) => set((s) => ({ shotsFired: s.shotsFired + bullets })),
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

      pickUpWeapon: (id) => set((s) => ({ weapon: applyPickup(s.weapon, id, gameTime()) })),

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
      partialize: (state) => ({ savedScores: state.savedScores }),
    },
  ),
)
