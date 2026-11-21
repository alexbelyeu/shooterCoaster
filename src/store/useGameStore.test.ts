import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runBest, useGameStore } from './useGameStore'
import { loadFraction, reportLoad } from '@/core/loadProgress'
import { advanceGameTime, resetGameTime } from '@/core/gameClock'
import { getAllLevels } from '@/levels/LevelRegistry'
import type { ScoreEntry } from '@/types/game'
import { dailySeed } from '@/levels/daily'
import { campaignScoreLimits } from '@/levels/scoreLimits'
import { buildLevelCards, nextLevelIndex } from '@/ui/screens/levelSelectModel'

// Node has no window/localStorage. zustand's persist reads `window.localStorage`
// when the store is created, so install a tiny in-memory Storage on a bare
// `window` object (vi.hoisted runs before the store module is imported). This
// stops a warning on every write and lets us check what gets persisted. It is a
// plain Map, not a DOM.
const memoryStorage = vi.hoisted(() => {
  const data = new Map<string, string>()
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size
    },
  }
  ;(globalThis as { window?: unknown }).window = { localStorage: storage }
  return storage
})

const initial = useGameStore.getState()

let now = 0
beforeEach(() => {
  memoryStorage.clear()
  useGameStore.setState(initial, true)
  resetGameTime()
  now = 10_000
  vi.spyOn(performance, 'now').mockImplementation(() => now)
})
afterEach(() => {
  vi.restoreAllMocks()
})

const store = () => useGameStore.getState()

function entry(level: string, score: number, stars: number): ScoreEntry {
  return { level, score, maxScore: 1000, stars, timestamp: 1 }
}

describe('combo', () => {
  it('first kill starts a 1x combo at the game time', () => {
    advanceGameTime(10)
    store().registerKill()
    expect(store().combo).toEqual({ count: 1, multiplier: 1, lastKillTime: 10 })
  })

  it('kills inside the window step through the 1x / 2x / 3x / 5x tiers', () => {
    const mults: number[] = []
    for (let i = 0; i < 15; i++) {
      store().registerKill()
      mults.push(store().combo.multiplier)
      advanceGameTime(1.39)
    }
    expect(mults).toEqual([1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 5])
    expect(store().combo.count).toBe(15)
  })

  it("a kill after the tier's game-time window starts a new chain", () => {
    store().registerKill()
    advanceGameTime(1.99)
    store().registerKill()
    advanceGameTime(2)
    store().registerKill()
    expect(store().combo.count).toBe(1)
    expect(store().combo.multiplier).toBe(1)
  })

  it('ignores the wall clock (a pause or a slow frame does not break it)', () => {
    store().registerKill()
    now += 60_000
    store().registerKill()
    expect(store().combo.count).toBe(2)
  })

  it('bestCombo tracks the longest streak of the run, not the current one', () => {
    for (let i = 0; i < 4; i++) {
      store().registerKill()
      advanceGameTime(0.1)
    }
    advanceGameTime(3)
    store().registerKill()
    expect(store().combo.count).toBe(1)
    expect(store().bestCombo).toBe(4)
  })

  it('resetCombo clears it', () => {
    store().registerKill()
    store().resetCombo()
    expect(store().combo).toEqual({ count: 0, multiplier: 1, lastKillTime: 0 })
  })
})

describe('addScore', () => {
  it('adds base points at 1x', () => {
    store().addScore(13)
    expect(store().score).toBe(13)
  })

  it('applies the current combo multiplier', () => {
    for (let i = 0; i < 4; i++) store().registerKill()
    store().addScore(20)
    expect(store().score).toBe(40)
    store().addScore(20)
    expect(store().score).toBe(80)
  })
})

describe('startRun', () => {
  it('resets the run, sets the level and the given seed, and opens on the loading screen', () => {
    store().addScore(50)
    store().registerShot()
    store().registerHit()
    store().registerKill()
    store().startRun('level2', { seed: 42 })
    expect(store()).toMatchObject({
      phase: 'loading',
      skipIntro: false,
      currentLevel: 'level2',
      runSeed: 42,
      score: 0,
      kills: 0,
      shotsFired: 0,
      hits: 0,
      bestCombo: 0,
      boss: null,
    })
    expect(store().combo).toEqual({ count: 0, multiplier: 1, lastKillTime: 0 })
  })

  it('starts at normal time when the last run ended in slow-mo (quit or restart during the last-kill slow-mo)', () => {
    store().startRun('level1', { seed: 1 })
    store().setSlowMo(0.1, 'on')
    store().setPhase('paused')
    store().startRun('level1', { seed: 1 })
    expect(store().timeScale).toBe(1)
    expect(store().frenzy).toBe('off')
  })

  it('starts from the same state as a fresh store', () => {
    const fresh = store()
    store().addScore(50)
    store().registerKill()
    store().setSlowMo(0.5, 'out')
    store().pickUpWeapon('spread')
    expect(store().weapon).not.toEqual(fresh.weapon)
    store().startRun('level1', { seed: 1 })
    for (const key of ['score', 'kills', 'shotsFired', 'hits', 'bestCombo', 'combo', 'timeScale', 'frenzy', 'boss', 'weapon'] as const)
      expect(store()[key], key).toEqual(fresh[key])
  })

  it('uses ?seed= from the URL when no seed is given', () => {
    const w = globalThis.window as unknown as { location?: { search: string } }
    w.location = { search: '?seed=777' }
    try {
      store().startRun('level1')
      expect(store().runSeed).toBe(777)
    } finally {
      delete w.location
    }
  })

  it('otherwise picks a fresh seed per run', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000)
    store().startRun('level1')
    expect(store().runSeed).toBe(1_000)
  })

  it('bumps runId every run, the same level and seed included (Restart)', () => {
    store().startRun('level1', { seed: 5 })
    const first = store().runId
    store().setPhase('paused')
    store().startRun('level1', { seed: 5 })
    expect(store().runId).toBe(first + 1)
  })

  it('keeps sceneReady for a restart of the warmed-up level, clears it for a new level (#597)', () => {
    store().startRun('level1', { seed: 5 })
    store().setSceneReady(true)
    store().startRun('level1', { seed: 5 })
    expect(store().sceneReady).toBe(true)
    store().startRun('level2', { seed: 5 })
    expect(store().sceneReady).toBe(false)
  })

  it('restarts a warm level straight into the countdown, a cold one through the loading screen, never the intro (#674)', () => {
    store().startRun('level1', { seed: 5 })
    store().setSceneReady(true)
    store().restartRun('results')
    expect(store()).toMatchObject({ phase: 'countdown', skipIntro: true, sceneReady: true })
    store().setSceneReady(false)
    store().restartRun('results')
    expect(store()).toMatchObject({ phase: 'loading', skipIntro: true })
    store().startRun('level1', { seed: 5 })
    expect(store().skipIntro).toBe(false)
  })

  it('keeps a warm level\'s loading stages for a new start of it, its scene won\'t report them again (#674)', () => {
    store().startRun('level1', { seed: 5 })
    for (const stage of ['chunk', 'scene', 'shaders', 'audio'] as const) reportLoad('level1', stage, 1)
    store().setSceneReady(true)
    store().startRun('level1', { seed: 5 })
    expect(store().phase).toBe('loading')
    expect(loadFraction()).toBeCloseTo(1, 10)
    store().startRun('level2', { seed: 5 })
    expect(loadFraction()).toBe(0)
  })

  it('lets a cold restart of the still-mounted level finish loading: its stages so far are kept (#686)', () => {
    store().startRun('level2', { seed: 5 })
    store().startRun('level1', { seed: 5 })
    for (const stage of ['chunk', 'scene'] as const) reportLoad('level1', stage, 1)
    reportLoad('level1', 'shaders', 0.4)
    store().restartRun('results')
    expect(store()).toMatchObject({ phase: 'loading', sceneReady: false })
    reportLoad('level1', 'shaders', 1)
    reportLoad('level1', 'audio', 1)
    expect(loadFraction()).toBeCloseTo(1, 10)
  })
})

describe('daily runs', () => {
  const daily = { mode: 'daily', dateKey: '2026-10-31' } as const

  it('seeds a daily run from its date, and ?seed= still overrides it', () => {
    store().startRun('level2', { mode: daily })
    expect(store().runSeed).toBe(dailySeed('2026-10-31'))
    expect(store().runMode).toEqual(daily)
    const w = globalThis.window as unknown as { location?: { search: string } }
    w.location = { search: '?seed=777' }
    try {
      store().startRun('level2', { mode: daily })
      expect(store().runSeed).toBe(777)
    } finally {
      delete w.location
    }
  })

  it('a plain startRun is a campaign run', () => {
    store().startRun('level2', { mode: daily })
    store().startRun('level1', { seed: 3 })
    expect(store().runMode).toEqual({ mode: 'campaign' })
  })

  it('restartRun keeps a daily run and its seed, and reseeds a campaign run', () => {
    store().startRun('level3', { seed: 99, mode: daily })
    store().restartRun('results')
    expect(store()).toMatchObject({ currentLevel: 'level3', runSeed: 99, runMode: daily })
    vi.spyOn(Date, 'now').mockReturnValue(1_000)
    store().startRun('level1', { seed: 5 })
    store().restartRun('results')
    expect(store()).toMatchObject({ currentLevel: 'level1', runSeed: 1_000, runMode: { mode: 'campaign' } })
  })

  it('records where a run started and the last campaign level, which a Daily Run leaves alone', () => {
    store().startRun('level2', { seed: 1, from: 'title' })
    expect(store()).toMatchObject({ runFrom: 'title', lastLevel: 'level2' })
    store().restartRun('pause')
    expect(store().runFrom).toBe('pause')
    store().startRun('level4', { seed: 1, mode: daily })
    expect(store()).toMatchObject({ runFrom: 'select', lastLevel: 'level2' })
  })

  it('startNextRun starts the level the worlds focus first, on an all-starred save the last one played (#818)', () => {
    const levels = getAllLevels()
    useGameStore.setState({ savedScores: Object.fromEntries(levels.map((l) => [l.id, entry(l.id, 100, 3)])) })
    store().startRun('level2', { seed: 1 })
    store().startNextRun('title')
    const cards = buildLevelCards(levels, store().savedScores, store().isLevelUnlocked, {})
    expect(store()).toMatchObject({ currentLevel: 'level2', runFrom: 'title', runMode: { mode: 'campaign' } })
    expect(cards[nextLevelIndex(cards, store().lastLevel)].id).toBe('level2')

    useGameStore.setState({ savedScores: { level1: entry('level1', 100, 1) } })
    store().startNextRun('title')
    expect(store().currentLevel).toBe('level2')
  })

  it('saves the day best and the streak without touching campaign scores or unlocks', () => {
    store().saveDailyScore(entry('level2', 500, 2), '2026-10-30')
    store().saveDailyScore(entry('level2', 300, 1), '2026-10-31')
    store().saveDailyScore(entry('level2', 200, 1), '2026-10-31')
    expect(store().savedDaily['2026-10-31'].score).toBe(300)
    expect(store().savedDaily['2026-10-30'].score).toBe(500)
    expect(store().dailyStreak).toEqual({ count: 2, lastKey: '2026-10-31' })
    expect(store().savedScores).toEqual({})
    expect(store().isLevelUnlocked('level3')).toBe(false)
  })

  it('saveRunResult keeps a daily run apart from the campaign, and runBest reads the run mode\'s best', () => {
    store().startRun('level2', { mode: daily })
    store().saveRunResult(entry('level2', 500, 2))
    expect(store().savedDaily['2026-10-31'].score).toBe(500)
    expect(store().savedScores).toEqual({})
    expect(runBest(store())?.score).toBe(500)

    store().startRun('level2', { seed: 1 })
    expect(runBest(store())).toBeUndefined()
    store().saveRunResult(entry('level2', 300, 1))
    expect(store().savedScores.level2.score).toBe(300)
    expect(store().savedDaily['2026-10-31'].score).toBe(500)
    expect(runBest(store())?.score).toBe(300)
  })

  it('drops daily bests older than 30 days', () => {
    store().saveDailyScore(entry('level1', 1, 0), '2026-09-01')
    store().saveDailyScore(entry('level1', 1, 0), '2026-10-31')
    expect(Object.keys(store().savedDaily)).toEqual(['2026-10-31'])
  })
})

describe('pause and resume', () => {
  it('resume starts the resume countdown only while paused; GO (setPhase) ends it', () => {
    store().setPhase('playing')
    store().resume()
    expect(store().resuming).toBe(false)
    store().setPhase('paused')
    store().resume()
    expect(store()).toMatchObject({ phase: 'paused', resuming: true })
    store().setPhase('playing')
    expect(store().resuming).toBe(false)
  })

  it('a pause during the resume countdown cancels it', () => {
    store().setPhase('paused')
    store().resume()
    store().setPhase('paused')
    expect(store().resuming).toBe(false)
  })

  it('Restart from the pause menu drops a pending resume', () => {
    store().setPhase('paused')
    store().resume()
    store().startRun('level1', { seed: 1 })
    expect(store().resuming).toBe(false)
  })
})

describe('photo mode (#828)', () => {
  it('opens only while paused and not counting down to resume', () => {
    store().setPhase('playing')
    store().setPhoto(true)
    expect(store().photo).toBe(false)
    store().setPhase('paused')
    store().resume()
    store().setPhoto(true)
    expect(store().photo).toBe(false)
    store().setPhase('paused')
    store().setPhoto(true)
    expect(store().photo).toBe(true)
    store().setPhoto(false)
    expect(store()).toMatchObject({ phase: 'paused', photo: false })
  })

  it('resume, a phase change and a restart all leave it', () => {
    for (const leave of [() => store().resume(), () => store().setPhase('levelSelect'), () => store().startRun('level1', { seed: 1 })]) {
      store().setPhase('paused')
      store().setPhoto(true)
      leave()
      expect(store().photo).toBe(false)
    }
  })
})

describe('saveScore', () => {
  it('keeps the best score per level', () => {
    store().saveScore(entry('level1', 500, 1))
    store().saveScore(entry('level1', 300, 0))
    expect(store().savedScores.level1.score).toBe(500)
    store().saveScore(entry('level1', 900, 3))
    expect(store().savedScores.level1.score).toBe(900)
    expect(store().savedScores.level1.stars).toBe(3)
  })

  it('does not overwrite on an equal score, and keeps levels independent', () => {
    const first = entry('level2', 400, 1)
    store().saveScore(first)
    store().saveScore({ ...entry('level2', 400, 1), timestamp: 2 })
    expect(store().savedScores.level2.timestamp).toBe(first.timestamp)
    store().saveScore(entry('level3', 10, 0))
    expect(Object.keys(store().savedScores).sort()).toEqual(['level2', 'level3'])
  })

  it('keeps the highest bestCombo across runs, even when the score is not a record', () => {
    store().saveScore({ ...entry('level1', 500, 1), bestCombo: 4 })
    store().saveScore({ ...entry('level1', 300, 0), bestCombo: 9 })
    expect(store().savedScores.level1).toMatchObject({ score: 500, bestCombo: 9 })
    store().saveScore({ ...entry('level1', 800, 2), bestCombo: 2 })
    expect(store().savedScores.level1).toMatchObject({ score: 800, bestCombo: 9 })
  })

  it('accepts old entries saved without bestCombo', () => {
    useGameStore.setState({ savedScores: { level1: entry('level1', 500, 1) } })
    store().saveScore({ ...entry('level1', 100, 0), bestCombo: 3 })
    expect(store().savedScores.level1).toMatchObject({ score: 500, bestCombo: 3 })
  })

  it('persists only saved scores, leaderboards, initials, the daily record and the last level (not score, combo or phase)', () => {
    store().addScore(42)
    store().saveScore(entry('level1', 500, 1))
    const persisted = JSON.parse(memoryStorage.getItem('shootercoaster-scores')!)
    expect(Object.keys(persisted.state)).toEqual(['savedScores', 'leaderboards', 'lastInitials', 'savedDaily', 'dailyStreak', 'lastLevel'])
    expect(persisted.state.savedScores.level1.score).toBe(500)
  })
})

describe('leaderboard', () => {
  it('enters a run under the last initials and renames it in place', () => {
    expect(store().addLeaderboardEntry('level1', { score: 500, stars: 1, date: 7 })).toBe(0)
    expect(store().leaderboards.level1[0]).toEqual({ initials: 'AAA', score: 500, stars: 1, date: 7, ruleset: '60s' })
    store().setEntryInitials('level1', 7, 'zed')
    expect(store().leaderboards.level1[0].initials).toBe('ZED')
    expect(store().lastInitials).toBe('ZED')
    expect(store().addLeaderboardEntry('level1', { score: 900, stars: 3, date: 8 })).toBe(0)
    expect(store().leaderboards.level1.map((e) => e.initials)).toEqual(['ZED', 'ZED'])
  })

  it('a run that misses a full board changes nothing', () => {
    for (let i = 0; i < 10; i++) store().addLeaderboardEntry('level2', { score: 1000 + i, stars: 1, date: i })
    const before = store().leaderboards
    expect(store().addLeaderboardEntry('level2', { score: 999, stars: 1, date: 99 })).toBeNull()
    expect(store().leaderboards).toBe(before)
  })

  it('round-trips through storage', async () => {
    store().addLeaderboardEntry('level1', { score: 500, stars: 1, date: 7 })
    store().setEntryInitials('level1', 7, 'BOB')
    const saved = memoryStorage.getItem('shootercoaster-scores')!
    useGameStore.setState(initial, true)
    memoryStorage.setItem('shootercoaster-scores', saved)
    await useGameStore.persist.rehydrate()
    expect(store().leaderboards.level1[0]).toMatchObject({ initials: 'BOB', score: 500 })
    expect(store().lastInitials).toBe('BOB')
  })

  it('loads without the long runs from before the 60 s rules, keeping their stars (#458)', async () => {
    const limit = campaignScoreLimits().level5.maxScore
    const old = (score: number, initials: string) => ({ initials, score, stars: 3, date: score })
    memoryStorage.setItem('shootercoaster-scores', JSON.stringify({
      state: {
        savedScores: { level5: { level: 'level5', score: limit + 1, maxScore: 1, stars: 3, timestamp: 1 } },
        leaderboards: { level5: [old(limit + 1, 'OLD'), old(limit - 1, 'MOD')] },
        lastInitials: 'OLD',
      },
      version: 0,
    }))
    await useGameStore.persist.rehydrate()
    expect(store().leaderboards.level5.map((e) => e.initials)).toEqual(['MOD'])
    expect(store().savedScores.level5).toMatchObject({ score: limit + 1, stars: 3 })
    expect(store().lastInitials).toBe('OLD')
  })

  it('the daily record round-trips through storage beside the boards', async () => {
    store().saveDailyScore(entry('level2', 400, 2), '2026-10-31')
    const saved = memoryStorage.getItem('shootercoaster-scores')!
    useGameStore.setState(initial, true)
    memoryStorage.setItem('shootercoaster-scores', saved)
    await useGameStore.persist.rehydrate()
    expect(store().savedDaily['2026-10-31']).toMatchObject({ level: 'level2', score: 400, stars: 2 })
    expect(store().dailyStreak).toEqual({ count: 1, lastKey: '2026-10-31' })
    expect(store().leaderboards).toEqual({})
  })

  it.each([
    ['not JSON', '{oops'],
    ['null state', JSON.stringify({ state: null, version: 0 })],
    [
      'wrong types',
      JSON.stringify({
        state: { savedScores: 'x', leaderboards: [1], lastInitials: 42, savedDaily: { nope: {} }, dailyStreak: { count: 'x' } },
        version: 0,
      }),
    ],
  ])('falls back to empty data on corrupt storage (%s)', async (_, raw) => {
    memoryStorage.setItem('shootercoaster-scores', raw)
    await useGameStore.persist.rehydrate()
    expect(store().savedScores).toEqual({})
    expect(store().leaderboards).toEqual({})
    expect(store().lastInitials).toBe('AAA')
    expect(store().savedDaily).toEqual({})
    expect(store().dailyStreak).toEqual({ count: 0, lastKey: null })
    expect(store().isLevelUnlocked('level2')).toBe(false)
  })

  it('a save from before the leaderboard starts the board with its best', async () => {
    memoryStorage.setItem('shootercoaster-scores', JSON.stringify({ state: { savedScores: { level1: entry('level1', 800, 2) } }, version: 0 }))
    await useGameStore.persist.rehydrate()
    expect(store().leaderboards.level1).toEqual([{ initials: '---', score: 800, stars: 2, date: 1 }])
    expect(store().isLevelUnlocked('level2')).toBe(true)
  })

  it('clearLocalData wipes scores, unlocks, boards and the daily record', () => {
    store().saveScore(entry('level1', 500, 1))
    store().addLeaderboardEntry('level1', { score: 500, stars: 1, date: 7 })
    store().setEntryInitials('level1', 7, 'BOB')
    store().saveDailyScore(entry('level1', 300, 1), '2026-10-31')
    store().startRun('level1', { seed: 1 })
    store().clearLocalData()
    expect(store().lastLevel).toBeNull()
    expect(store().savedScores).toEqual({})
    expect(store().leaderboards).toEqual({})
    expect(store().savedDaily).toEqual({})
    expect(store().dailyStreak).toEqual({ count: 0, lastKey: null })
    expect(store().lastInitials).toBe('AAA')
    expect(store().isLevelUnlocked('level2')).toBe(false)
  })
})

describe('isLevelUnlocked', () => {
  const levels = getAllLevels()

  it('only level1 is unlocked on a fresh save', () => {
    expect(store().isLevelUnlocked('level1')).toBe(true)
    for (const l of levels.slice(1)) expect(store().isLevelUnlocked(l.id), l.id).toBe(false)
  })

  it('an unknown level id is never unlocked', () => {
    expect(store().isLevelUnlocked('level99')).toBe(false)
  })

  it('a 0-star result does not unlock the next level', () => {
    store().saveScore(entry('level1', 10, 0))
    expect(store().isLevelUnlocked('level2')).toBe(false)
  })

  it('earning 1+ star unlocks exactly the next level in the nextLevel chain', () => {
    for (const l of levels) {
      if (!l.nextLevel) continue
      useGameStore.setState({ savedScores: {} })
      expect(store().isLevelUnlocked(l.nextLevel), `${l.nextLevel} before`).toBe(false)
      store().saveScore(entry(l.id, 500, 1))
      expect(store().isLevelUnlocked(l.nextLevel), `${l.nextLevel} after ${l.id}`).toBe(true)
    }
  })
})
