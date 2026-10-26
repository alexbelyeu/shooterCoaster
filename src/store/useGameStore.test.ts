import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameStore } from './useGameStore'
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
  it('first kill starts a 1x combo', () => {
    store().registerKill()
    expect(store().combo).toEqual({ count: 1, multiplier: 1, lastKillTime: 10_000 })
  })

  it('kills inside the 2s window grow the multiplier by 0.25 each', () => {
    store().registerKill()
    now += 1999
    store().registerKill()
    expect(store().combo.count).toBe(2)
    expect(store().combo.multiplier).toBe(1.25)
    now += 1000
    store().registerKill()
    expect(store().combo.multiplier).toBe(1.5)
  })

  it('a kill after the window (>= 2000ms) resets the combo', () => {
    store().registerKill()
    now += 1000
    store().registerKill()
    now += 2000
    store().registerKill()
    expect(store().combo.count).toBe(1)
    expect(store().combo.multiplier).toBe(1)
  })

  it('multiplier caps at 4x', () => {
    for (let i = 0; i < 30; i++) {
      store().registerKill()
      now += 100
    }
    expect(store().combo.count).toBe(30)
    expect(store().combo.multiplier).toBe(4)
  })

  it('bestCombo tracks the longest streak of the run, not the current one', () => {
    for (let i = 0; i < 4; i++) {
      store().registerKill()
      now += 100
    }
    now += 3000
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
    store().registerKill()
    now += 500
    store().registerKill() // 1.25x
    store().addScore(20)
    expect(store().score).toBe(25)
    store().addScore(20)
    expect(store().score).toBe(50)
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
