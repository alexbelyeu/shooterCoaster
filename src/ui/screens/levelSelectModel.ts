/** Pure data + keyboard navigation behind the level select (no React / DOM, unit-tested). */
import type { BiomeType } from '@/types/level'
import type { ScoreEntry } from '@/types/game'

export interface LevelSelectSource {
  id: string
  name: string
  description: string
  biome: BiomeType
  maxScore: number
  nextLevel: string | null
}

export interface LevelCard {
  id: string
  name: string
  description: string
  biome: BiomeType
  unlocked: boolean
  stars: number
  bestScore: number
  maxScore: number
  /** Name of the level whose star unlocks this one (null when unlocked or first). */
  unlockedBy: string | null
}

export const STARS_PER_LEVEL = 3

export function buildLevelCards(
  levels: readonly LevelSelectSource[],
  savedScores: Record<string, ScoreEntry | undefined>,
  isUnlocked: (id: string) => boolean,
): LevelCard[] {
  return levels.map((level) => {
    const unlocked = isUnlocked(level.id)
    const saved = savedScores[level.id]
    const previous = levels.find((l) => l.nextLevel === level.id)
    return {
      id: level.id,
      name: level.name,
      description: level.description,
      biome: level.biome,
      unlocked,
      stars: unlocked ? Math.max(0, Math.min(STARS_PER_LEVEL, saved?.stars ?? 0)) : 0,
      bestScore: unlocked ? Math.max(0, saved?.score ?? 0) : 0,
      maxScore: level.maxScore,
      unlockedBy: unlocked ? null : (previous?.name ?? null),
    }
  })
}

export function totalStars(cards: readonly LevelCard[]): { earned: number; max: number } {
  let earned = 0
  for (const c of cards) earned += c.stars
  return { earned, max: cards.length * STARS_PER_LEVEL }
}

/** Card to focus first: the first unlocked level without a star (the next one to play), else the last unlocked. */
export function initialFocusIndex(cards: readonly LevelCard[]): number {
  const fresh = cards.findIndex((c) => c.unlocked && c.stars === 0)
  if (fresh >= 0) return fresh
  for (let i = cards.length - 1; i >= 0; i--) if (cards[i].unlocked) return i
  return 0
}

export type NavKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End'

export function isNavKey(key: string): key is NavKey {
  return (
    key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' ||
    key === 'ArrowDown' || key === 'Home' || key === 'End'
  )
}

export interface CardRect {
  x: number
  y: number
  width: number
  height: number
}

/** Left / right step in reading order; up / down pick the nearest card in the adjacent row, however the row wraps. */
export function navigateCards(rects: readonly CardRect[], from: number, key: NavKey): number {
  const n = rects.length
  if (n === 0) return 0
  const i = Math.max(0, Math.min(n - 1, from))
  if (key === 'Home') return 0
  if (key === 'End') return n - 1
  if (key === 'ArrowLeft') return Math.max(0, i - 1)
  if (key === 'ArrowRight') return Math.min(n - 1, i + 1)

  const dir = key === 'ArrowDown' ? 1 : -1
  const a = rects[i]
  const ax = a.x + a.width / 2
  const ay = a.y + a.height / 2
  let best = i
  let bestScore = Infinity
  for (let j = 0; j < n; j++) {
    if (j === i) continue
    const b = rects[j]
    const dy = (b.y + b.height / 2 - ay) * dir
    if (dy < Math.min(a.height, b.height) / 2) continue
    const dx = Math.abs(b.x + b.width / 2 - ax)
    const score = dy * 4 + dx
    if (score < bestScore) {
      bestScore = score
      best = j
    }
  }
  return best
}
