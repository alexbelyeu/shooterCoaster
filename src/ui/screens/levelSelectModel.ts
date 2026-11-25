/** Pure data + keyboard navigation behind the level select (no React / DOM, unit-tested). */
import type { BiomeType } from '@/types/level'
import type { LeaderboardEntry, ScoreEntry } from '@/types/game'
import { currentStreak, dailyKey, dailyLevel, type DailyStreak } from '@/levels/daily'
import { previousLevel } from '@/levels/LevelRegistry'
import { rushStages, rushUnlocked, type RushLevel } from '@/levels/bossRush'
import { NIGHT_ATMOSPHERES, hasNightRide } from '@/levels/environments/nightPreset'
import type { Medal } from '@/levels/medals'

export interface LevelSelectSource {
  id: string
  name: string
  description: string
  biome: BiomeType
  nextLevel: string | null
}

export interface LevelCard {
  id: string
  name: string
  description: string
  biome: BiomeType
  unlocked: boolean
  stars: number
  /** The board's top score, or the saved best when the board is empty; read with `bestInitials` from one entry. */
  bestScore: number
  /** Initials on the top of the level's board (null when locked or empty). */
  bestInitials: string | null
  /** Name of the level whose star unlocks this one (null when unlocked or first). */
  unlockedBy: string | null
  /** Offers the Night Ride toggle (#829): the level has all its stars and its biome a night preset. */
  nightRide: boolean
  /** The level's three medals (#879) and which it has won; none while it is locked. */
  medals: { id: string; name: string; line: string; earned: boolean }[]
}

export const STARS_PER_LEVEL = 3

/** What a card's medals say aloud: "1 of 3 medals, Gold Rush". */
/** The card's medals for its aria-label: every one named, a won one as won and an unwon one with its feat (#904). */
export function medalsLine(medals: readonly Pick<LevelCard['medals'][number], 'name' | 'line' | 'earned'>[]): string {
  const won = medals.filter((m) => m.earned).length
  const each = medals.map((m) => (m.earned ? `${m.name}, won` : `${m.name}: ${m.line}`))
  return `${won} of ${medals.length} medals${each.length > 0 ? `. ${each.join('. ')}` : ''}`
}

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`

/** A card flipped to its Night Ride (#1057) paints its postcard on the night preset's sky, zenith to horizon; null without one. */
export function nightPostcardSky(biome: BiomeType): string | null {
  const sky = NIGHT_ATMOSPHERES[biome]?.sky
  return sky ? `linear-gradient(180deg, ${hex(sky.zenith)} 0%, ${hex(sky.horizon)} 100%)` : null
}

export function buildLevelCards(
  levels: readonly LevelSelectSource[],
  savedScores: Record<string, ScoreEntry | undefined>,
  isUnlocked: (id: string) => boolean,
  leaderboards: Record<string, readonly LeaderboardEntry[] | undefined>,
  savedMedals: Record<string, readonly string[] | undefined> = {},
  /** A level's medals (`levels/medals.ts` `levelMedals`), passed in so the store's startup path doesn't carry the table. */
  medalsOf: (levelId: string) => readonly Medal[] = () => [],
): LevelCard[] {
  return levels.map((level) => {
    const unlocked = isUnlocked(level.id)
    const saved = savedScores[level.id]
    const stars = unlocked ? Math.max(0, Math.min(STARS_PER_LEVEL, saved?.stars ?? 0)) : 0
    const top = leaderboards[level.id]?.[0]
    const previousId = unlocked ? null : previousLevel(level.id, levels)
    return {
      id: level.id,
      name: level.name,
      description: level.description,
      biome: level.biome,
      unlocked,
      stars,
      bestScore: unlocked ? Math.max(0, (top ?? saved)?.score ?? 0) : 0,
      bestInitials: unlocked ? (top?.initials ?? null) : null,
      unlockedBy: levels.find((l) => l.id === previousId)?.name ?? null,
      nightRide: stars === STARS_PER_LEVEL && hasNightRide(level.biome),
      medals: unlocked
        ? medalsOf(level.id).map(({ id, name, line }) => ({ id, name, line, earned: savedMedals[level.id]?.includes(id) ?? false }))
        : [],
    }
  })
}

export interface DailyCard {
  dateKey: string
  levelId: string
  levelName: string
  biome: BiomeType
  /** Today's best daily score, 0 when not played yet. */
  bestScore: number
  /** Consecutive days with a finished daily, 0 once a day is missed. */
  streak: number
}

/** The Daily Run card for `now`'s UTC day; never locked, whatever the campaign progress. */
export function buildDailyCard(
  now: Date,
  levels: readonly LevelSelectSource[],
  savedDaily: Record<string, ScoreEntry | undefined>,
  streak: DailyStreak,
): DailyCard {
  const dateKey = dailyKey(now)
  const levelId = dailyLevel(dateKey)
  const level = levels.find((l) => l.id === levelId)
  return {
    dateKey,
    levelId,
    levelName: level?.name ?? levelId,
    biome: level?.biome ?? 'themePark',
    bestScore: Math.max(0, savedDaily[dateKey]?.score ?? 0),
    streak: currentStreak(streak, dateKey),
  }
}

export interface RushCard {
  first: string
  /** The last stage's biome, the ticket's colours. */
  biome: BiomeType
  bosses: number
  unlocked: boolean
}

/** The Boss Rush ticket (#1011): its stages from every level with a boss, open once every level has all its stars. */
export function buildRushCard(levels: readonly (LevelSelectSource & RushLevel)[], stars: (levelId: string) => number): RushCard {
  const stages = rushStages(levels)
  const last = levels.find((l) => l.id === stages[stages.length - 1]?.levelId)
  return {
    first: stages[0]?.levelId ?? '',
    biome: last?.biome ?? 'themePark',
    bosses: stages.length,
    unlocked: stages.length > 0 && rushUnlocked(levels, stars),
  }
}

export function totalStars(cards: readonly LevelCard[]): { earned: number; max: number } {
  let earned = 0
  for (const c of cards) earned += c.stars
  return { earned, max: cards.length * STARS_PER_LEVEL }
}

/**
 * The player's next level, the one rule title PLAY starts (`startNextRun`, #329) and level select focuses first (#818):
 * the first unlocked level without a star (the chain unlocks it), else the last campaign level played, else the first.
 */
export function nextLevelIndex(cards: readonly Pick<LevelCard, 'id' | 'unlocked' | 'stars'>[], lastLevel: string | null): number {
  const fresh = cards.findIndex((c) => c.unlocked && c.stars === 0)
  if (fresh >= 0) return fresh
  return Math.max(0, cards.findIndex((c) => c.unlocked && c.id === lastLevel))
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
