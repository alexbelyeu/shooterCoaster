import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameStore } from './useGameStore'
import { advanceGameTime, resetGameTime } from '@/core/gameClock'
import { getAllLevels } from '@/levels/LevelRegistry'
import type { ScoreEntry } from '@/types/game'

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

  it('resetScore zeroes it', () => {
    store().addScore(99)
    store().resetScore()
    expect(store().score).toBe(0)
  })
})

describe('startRun', () => {
  it('resets the run, sets the level and the given seed, and enters the countdown', () => {
    store().addScore(50)
    store().registerShot()
    store().registerHit()
    store().registerKill()
    store().startRun('level2', 42)
    expect(store()).toMatchObject({
      phase: 'countdown',
      currentLevel: 'level2',
      runSeed: 42,
      score: 0,
      kills: 0,
      shotsFired: 0,
      hits: 0,
      bestCombo: 0,
    })
    expect(store().combo).toEqual({ count: 0, multiplier: 1, lastKillTime: 0 })
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
    store().startRun('level1', 5)
    const first = store().runId
    store().setPhase('paused')
    store().startRun('level1', 5)
    expect(store().runId).toBe(first + 1)
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
    store().startRun('level1', 1)
    expect(store().resuming).toBe(false)
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

  it('persists only savedScores (not score, combo or phase)', () => {
    store().addScore(42)
    store().saveScore(entry('level1', 500, 1))
    const persisted = JSON.parse(memoryStorage.getItem('shootercoaster-scores')!)
    expect(Object.keys(persisted.state)).toEqual(['savedScores'])
    expect(persisted.state.savedScores.level1.score).toBe(500)
  })

  it('resetSavedScores clears everything', () => {
    store().saveScore(entry('level1', 500, 1))
    store().resetSavedScores()
    expect(store().savedScores).toEqual({})
  })
})

describe('isLevelUnlocked', () => {
  const levels = getAllLevels()

  it('only level1 is unlocked on a fresh save', () => {
    expect(store().isLevelUnlocked('level1')).toBe(true)
    for (const l of levels.slice(1)) expect(store().isLevelUnlocked(l.id), l.id).toBe(false)
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
