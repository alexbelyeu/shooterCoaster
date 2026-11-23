import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { changedOnly } from './changedOnlyStorage'
import type { Route } from '@/track/mechanics'
import type { GamePhase, ScoreEntry, ComboState, BossHud, RunFrom, RunMode, RideVariant } from '@/types/game'
import {
  DEFAULT_INITIALS,
  insertEntry,
  normalizeInitials,
  RULESET,
  sanitizeLeaderboards,
  sanitizeSavedDaily,
  sanitizeSavedScores,
  sanitizeStreak,
  type Leaderboards,
} from './leaderboard'
import { seedFromQuery } from '@/utils/rng'
import { gameTime } from '@/core/gameClock'
import { markStartup } from '@/core/startupMarks'
import { comboExpired, comboMultiplier, type FrenzyStage } from '@/combat/comboTiers'
import { startPhaseFor } from './startPhase'
import { resetLoad } from '@/core/loadProgress'
import { NO_PICKUP, applyPickup, type PickupWeaponId, type WeaponState } from '@/combat/weapons/weaponTypes'
import { clearGhosts } from '@/combat/ghostKey'
import { dailySeed, extendStreak, pruneDaily, type DailyStreak } from '@/levels/daily'
import { getAllLevels, getLevelConfig, previousLevel } from '@/levels/LevelRegistry'
import { buildLevelCards, nextLevelIndex } from '@/ui/screens/levelSelectModel'
import { scoreAfterPenalty } from '@/levels/scoring'
// The generated table, not `scoreLimits()`, which would pull the boss specs into the startup JS.
import { LEVEL_LIMITS } from '../../api/_lib/levelLimits'

const CAMPAIGN: RunMode = { mode: 'campaign' }

export interface StartRunOptions {
  seed?: number
  mode?: RunMode
  replay?: boolean
  from?: RunFrom
  /** A campaign run's Night Ride (#829); a daily is always by day. */
  variant?: RideVariant
}

const boardCeilings = () => Object.fromEntries(Object.entries(LEVEL_LIMITS).map(([id, l]) => [id, l.maxScore]))

interface GameState {
  phase: GamePhase
  /** Also ends a resume countdown. */
  setPhase: (phase: GamePhase) => void
  /** Still `paused` through the resume Ready / GO (`ui/hud/Countdown` sets `playing` on GO), so nothing moves until then. */
  resuming: boolean
  /**
   * A no-op in photo mode (#832): only Back (`setPhoto(false)`) leaves it, so the pause card's Esc, still
   * listening through its exit animation, and a pad's Start never start the countdown from a photo.
   */
  resume: () => void
  /** Photo mode (#828): the paused ride's camera orbits for a picture, the pause card and HUD hidden. Only while paused. */
  photo: boolean
  /** Enters photo mode (a no-op unless paused and not counting down to resume) or leaves it. */
  setPhoto: (on: boolean) => void

  currentLevel: string | null

  /** Seeds this run's enemy spawns. */
  runSeed: number
  /** Bumped by every `startRun`: per-run state resets on it, never on a phase change (paused → playing can be a Restart). */
  runId: number
  runMode: RunMode
  runFrom: RunFrom
  /** Day, or the level's Night Ride (#829): set by every `startRun` (day unless asked), kept by a restart. */
  runVariant: RideVariant
  /** The last campaign level started, persisted: title PLAY falls back to it once every level has a star. */
  lastLevel: string | null
  /**
   * The one way to start a level (enters `loading`, `playing` under `?e2e=1`; `startPhase.ts`); seed precedence:
   * `seed` > `?seed=` > the daily seed of `mode.dateKey` (daily runs) > `Date.now()`. A `replay` skips the intro, and
   * the loading screen too when the level is still warm. A campaign run from level select unless told otherwise.
   */
  startRun: (levelId: string, options?: StartRunOptions) => void
  /** Starts the player's next level (`nextLevelIndex`, the one level select focuses first): title PLAY, #329. */
  startNextRun: (from: RunFrom) => void
  /** Restarts the current level in the same mode: a daily keeps its seed, a campaign run gets a fresh one. */
  restartRun: (from: RunFrom) => void
  /** This run's loading screen goes straight to the countdown (a restart), not the intro. */
  skipIntro: boolean

  score: number
  addScore: (points: number) => void

  kills: number
  shotsFired: number
  /** Bullets that hit a target (`processHit`), each once however many it pierces. */
  hits: number
  bestCombo: number
  registerShot: (bullets?: number) => void
  registerHit: () => void
  /** Ids of the bystanders shot this run (#518). */
  bystandersHit: readonly string[]
  /** Takes `penalty` off the score (floored at 0) once per bystander: the points actually taken, null when `id` was already hit. */
  hitBystander: (id: string, penalty: number) => number | null

  // Combo (tiers and windows: combat/comboTiers.ts; expiry: combat/comboRuntime.hot.ts)
  combo: ComboState
  /** Call before `addScore`, so the kill scores at the tier it reaches. */
  registerKill: () => void
  resetCombo: () => void

  weapon: WeaponState
  pickUpWeapon: (id: PickupWeaponId) => void

  /** The way this run takes through the track's junctions (#702): 'hard' once the switch sign is shot. */
  route: Route
  setRoute: (route: Route) => void

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

  leaderboards: Leaderboards
  /** The default for the next entry. */
  lastInitials: string
  /** Enters a run under `lastInitials`; returns its 0-based rank, or null when it misses the board. */
  addLeaderboardEntry: (levelId: string, run: { score: number; stars: number; date: number }) => number | null
  setEntryInitials: (levelId: string, date: number, initials: string) => void
  /** Settings "Clear local data": scores, stars (so unlocks), leaderboards, the last level played and the Daily Run's bests and streak. */
  clearLocalData: () => void

  /** Best daily run per UTC day (`YYYY-MM-DD`), the last `DAILY_KEEP_DAYS` only; never touches `savedScores`. */
  savedDaily: Record<string, ScoreEntry>
  dailyStreak: DailyStreak
  /** Keeps the higher score of the day and extends the streak. */
  saveDailyScore: (entry: ScoreEntry, dateKey: string) => void
  /** Saves a finished run where its mode keeps bests: the day's daily best, or the level's campaign best. */
  saveRunResult: (entry: ScoreEntry) => void

  timeScale: number
  frenzy: FrenzyStage
  /** Only `combat/slowMo.hot.ts` calls this (lint: `sc/one-slow-mo-writer`); everyone else requests a slow-mo there. */
  setSlowMo: (timeScale: number, frenzy: FrenzyStage) => void

  /** The mounted level's shader warm-up is done (`canvas/ShaderWarmup.tsx`); the loading screen holds until then. */
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
  bystandersHit: [] as readonly string[],
  bestCombo: 0,
  combo: NO_COMBO,
  timeScale: 1,
  frenzy: 'off',
  boss: null,
  weapon: NO_PICKUP,
  route: 'easy',
} satisfies Partial<GameState>

const urlSearch = (): string | null =>
  typeof window !== 'undefined' && window.location ? window.location.search : null

function urlSeed(): number | null {
  const search = urlSearch()
  return search === null ? null : seedFromQuery(search)
}

/** The current run's best so far in its own mode: today's daily best, or the level's campaign best. */
export function runBest(s: Pick<GameState, 'runMode' | 'currentLevel' | 'savedDaily' | 'savedScores'>): ScoreEntry | undefined {
  if (s.runMode.mode === 'daily') return s.savedDaily[s.runMode.dateKey]
  return s.currentLevel ? s.savedScores[s.currentLevel] : undefined
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      phase: 'title',
      setPhase: (phase) => set({ phase, resuming: false, photo: false }),
      resuming: false,
      resume: () => set((s) => (s.phase === 'paused' && !s.photo ? { resuming: true } : {})),
      photo: false,
      setPhoto: (on) => set((s) => (on ? (s.phase === 'paused' && !s.resuming ? { photo: true } : {}) : { photo: false })),

      ...FRESH_RUN,
      currentLevel: null,

      runSeed: 0,
      runId: 0,
      runMode: CAMPAIGN,
      runFrom: 'select',
      runVariant: 'day',
      lastLevel: null,
      startRun: (levelId, { seed, mode = CAMPAIGN, replay = false, from = 'select', variant = 'day' } = {}) => {
        markStartup('runStart')
        const fallback = mode.mode === 'daily' ? dailySeed(mode.dateKey) : Date.now()
        const s = get()
        // A new level isn't warmed up yet: the outgoing level's `sceneReady` must not end its loading screen (#597).
        const warm = levelId === s.currentLevel && s.sceneReady
        const phase = startPhaseFor({ search: urlSearch() ?? '', warm, replay })
        // The same level's scene stays mounted and won't report its stages again, warm or still warming up; an
        // unmounted one was zeroed as it left (`unloadLevel`) and reports them all once it mounts.
        if (levelId !== s.currentLevel) resetLoad(levelId)
        set({
          ...FRESH_RUN,
          currentLevel: levelId,
          runSeed: (seed ?? urlSeed() ?? fallback) >>> 0,
          runMode: mode,
          runFrom: from,
          runVariant: mode.mode === 'daily' ? 'day' : variant,
          lastLevel: mode.mode === 'campaign' ? levelId : s.lastLevel,
          runId: s.runId + 1,
          sceneReady: warm,
          phase,
          resuming: false,
          photo: false,
          skipIntro: replay,
        })
      },
      restartRun: (from) => {
        const { currentLevel, runMode, runSeed, runVariant, startRun } = get()
        if (!currentLevel) return
        startRun(currentLevel, { seed: runMode.mode === 'daily' ? runSeed : undefined, mode: runMode, replay: true, from, variant: runVariant })
      },
      startNextRun: (from) => {
        const { savedScores, isLevelUnlocked, lastLevel, startRun } = get()
        const cards = buildLevelCards(getAllLevels(), savedScores, isLevelUnlocked, {})
        startRun(cards[nextLevelIndex(cards, lastLevel)].id, { from })
      },
      skipIntro: false,

      addScore: (points) => set((s) => ({ score: s.score + points * s.combo.multiplier })),
      registerShot: (bullets = 1) => set((s) => ({ shotsFired: s.shotsFired + bullets })),
      registerHit: () => set((s) => ({ hits: s.hits + 1 })),
      hitBystander: (id, penalty) => {
        const s = get()
        if (s.bystandersHit.includes(id)) return null
        const score = scoreAfterPenalty(s.score, penalty)
        set({ score, bystandersHit: [...s.bystandersHit, id] })
        return s.score - score
      },

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

      pickUpWeapon: (id) => set({ weapon: applyPickup(id, gameTime()) }),
      setRoute: (route) => set({ route }),

      timeRemaining: 0,
      setTimeRemaining: (t) => set({ timeRemaining: t }),

      enemiesRemaining: 0,
      totalEnemies: 0,
      setEnemyCounts: (remaining, total) => set({ enemiesRemaining: remaining, totalEnemies: total }),

      setSlowMo: (timeScale, frenzy) => set({ timeScale, frenzy }),

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

      leaderboards: {},
      lastInitials: DEFAULT_INITIALS,
      addLeaderboardEntry: (levelId, run) => {
        const s = get()
        const { board, rank } = insertEntry(s.leaderboards[levelId] ?? [], { ...run, initials: s.lastInitials, ruleset: RULESET })
        if (rank !== null) set({ leaderboards: { ...s.leaderboards, [levelId]: board } })
        return rank
      },
      setEntryInitials: (levelId, date, initials) =>
        set((s) => {
          const letters = normalizeInitials(initials)
          const board = s.leaderboards[levelId]
          if (!board?.some((e) => e.date === date)) return { lastInitials: letters }
          return {
            lastInitials: letters,
            leaderboards: {
              ...s.leaderboards,
              [levelId]: board.map((e) => (e.date === date ? { ...e, initials: letters } : e)),
            },
          }
        }),
      clearLocalData: () => {
        clearGhosts()
        set({
          savedScores: {},
          leaderboards: {},
          lastInitials: DEFAULT_INITIALS,
          savedDaily: {},
          dailyStreak: { count: 0, lastKey: null },
          lastLevel: null,
        })
      },

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
      saveRunResult: (entry) => {
        const { runMode, saveDailyScore, saveScore } = get()
        if (runMode.mode === 'daily') saveDailyScore(entry, runMode.dateKey)
        else saveScore(entry)
      },

      isLevelUnlocked: (levelId) => {
        if (!getLevelConfig(levelId)) return false
        const prev = previousLevel(levelId)
        return prev === null || (get().savedScores[prev]?.stars ?? 0) >= 1
      },
    }),
    {
      name: 'shootercoaster-scores',
      storage: changedOnly(createJSONStorage(() => window.localStorage)),
      partialize: (state) => ({
        savedScores: state.savedScores,
        leaderboards: state.leaderboards,
        lastInitials: state.lastInitials,
        savedDaily: state.savedDaily,
        dailyStreak: state.dailyStreak,
        lastLevel: state.lastLevel,
      }),
      // Hand-edited, older or half-written storage loads as valid data or not at all.
      merge: (persisted, current) => {
        const p = (typeof persisted === 'object' && persisted !== null ? persisted : {}) as Record<string, unknown>
        const savedScores = sanitizeSavedScores(p.savedScores)
        return {
          ...current,
          savedScores,
          leaderboards: sanitizeLeaderboards(p.leaderboards, savedScores, boardCeilings()),
          lastInitials: normalizeInitials(p.lastInitials),
          savedDaily: sanitizeSavedDaily(p.savedDaily),
          dailyStreak: sanitizeStreak(p.dailyStreak),
          lastLevel: typeof p.lastLevel === 'string' && getLevelConfig(p.lastLevel) ? p.lastLevel : null,
        }
      },
    },
  ),
)
