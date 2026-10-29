import { describe, expect, it } from 'vitest'
import { getAllLevels, getLevelConfig } from './LevelRegistry'
import { SCORE_VALUES, computeMaxScore, computeStars } from './scoring'
import type { EnemyType } from '@/types/level'
import { BOSS_SPECS } from '@/entities/bosses/bossSpecs'
import { bossMaxScore } from '@/entities/bosses/bossModel'

const levels = getAllLevels()

describe('LevelRegistry', () => {
  it('has unique ids and unique, ascending order values', () => {
    const ids = levels.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    const orders = levels.map((l) => l.order)
    expect(new Set(orders).size).toBe(orders.length)
    expect([...orders].sort((a, b) => a - b)).toEqual(orders)
  })

  it('getLevelConfig finds every level and rejects unknown ids', () => {
    for (const l of levels) expect(getLevelConfig(l.id)).toBe(l)
    expect(getLevelConfig('nope')).toBeUndefined()
  })

  it('combat overrides are hex colours and positive sizes', () => {
    for (const { combat } of levels) {
      if (combat?.bulletColor !== undefined) expect(combat.bulletColor).toMatch(/^#[0-9a-f]{6}$/i)
      if (combat?.bulletSize !== undefined) expect(combat.bulletSize).toBeGreaterThan(0)
    }
    expect(getLevelConfig('level4')?.combat).toEqual({ bulletColor: '#000000', bulletSize: 40 })
  })

  it.each(levels.map((l) => [l.id, l] as const))(
    '%s: maxScore equals Σ(count × SCORE_VALUES) plus the boss',
    (_id, level) => {
      expect(level.maxScore).toBe(computeMaxScore(level.enemies, level.boss && BOSS_SPECS[level.boss.type]))
    },
  )

  it('Theme Park ends on the Golden Blimp, which raises its maxScore to 2675', () => {
    const level1 = getLevelConfig('level1')!
    expect(level1.boss?.type).toBe('goldenBlimp')
    expect(level1.maxScore).toBe(13 * 150 + bossMaxScore(BOSS_SPECS.goldenBlimp))
    expect(level1.maxScore).toBe(2675)
  })

  it('a boss arrives after its tell and before the timer runs out', () => {
    for (const l of levels) {
      if (!l.boss) continue
      const { tell } = BOSS_SPECS[l.boss.type]
      expect(l.boss.at - tell.seconds, l.id).toBeGreaterThan(0)
      expect(l.boss.at, l.id).toBeLessThan(l.timerSeconds)
    }
  })

  it('every enemy type used by a level has a positive score value', () => {
    for (const l of levels) {
      for (const w of l.enemies) {
        expect(SCORE_VALUES[w.type], `${l.id}/${w.type}`).toBeGreaterThan(0)
        expect(w.count).toBeGreaterThan(0)
      }
    }
  })

  it('nextLevel chain starts at the first level, visits every level once, ends in null', () => {
    const visited: string[] = []
    let id: string | null = levels[0].id
    while (id !== null) {
      expect(visited, `cycle at ${id}`).not.toContain(id)
      visited.push(id)
      const cfg = getLevelConfig(id)
      expect(cfg, `nextLevel points at missing level ${id}`).toBeDefined()
      id = cfg!.nextLevel
    }
    expect(visited).toEqual(levels.map((l) => l.id))
  })

  it.each(levels.map((l) => [l.id, l] as const))(
    '%s: star thresholds are strictly ascending fractions in (0, 1]',
    (_id, level) => {
      const [one, two, three] = level.starThresholds
      expect(one).toBeGreaterThan(0)
      expect(two).toBeGreaterThan(one)
      expect(three).toBeGreaterThan(two)
      expect(three).toBeLessThanOrEqual(1)
    },
  )

  it('every level has a positive timer and at least one wave', () => {
    for (const l of levels) {
      expect(l.timerSeconds).toBeGreaterThan(0)
      expect(l.enemies.length).toBeGreaterThan(0)
    }
  })
})

describe('computeMaxScore', () => {
  it('sums count × value over waves', () => {
    expect(computeMaxScore([])).toBe(0)
    expect(
      computeMaxScore([
        { type: 'balloon', count: 2 },
        { type: 'infernalDrake', count: 1 },
      ]),
    ).toBe(2 * SCORE_VALUES.balloon + SCORE_VALUES.infernalDrake)
    expect(computeMaxScore([{ type: 'balloon', count: 1 }], BOSS_SPECS.goldenBlimp)).toBe(
      SCORE_VALUES.balloon + bossMaxScore(BOSS_SPECS.goldenBlimp),
    )
  })

  it('has a score value for every enemy type', () => {
    const types: EnemyType[] = [
      'balloon', 'crow', 'scorpion', 'shark', 'jellyfish', 'flyingFish', 'snowman',
      'snowmanScout', 'snowmanBrute', 'emberWisp', 'lavaGolem', 'fireImp', 'infernalDrake',
    ]
    for (const t of types) expect(Number.isInteger(SCORE_VALUES[t])).toBe(true)
  })
})

describe('computeStars', () => {
  const thresholds: [number, number, number] = [0.25, 0.55, 0.85]

  it('awards 0-3 stars at the threshold boundaries', () => {
    expect(computeStars(0, 1000, thresholds)).toBe(0)
    expect(computeStars(249, 1000, thresholds)).toBe(0)
    expect(computeStars(250, 1000, thresholds)).toBe(1)
    expect(computeStars(549, 1000, thresholds)).toBe(1)
    expect(computeStars(550, 1000, thresholds)).toBe(2)
    expect(computeStars(849, 1000, thresholds)).toBe(2)
    expect(computeStars(850, 1000, thresholds)).toBe(3)
  })

  it('caps at 3 when combos push the score past maxScore', () => {
    expect(computeStars(4000, 1000, thresholds)).toBe(3)
  })

  it('returns 0 for a non-positive maxScore instead of dividing by zero', () => {
    expect(computeStars(100, 0, thresholds)).toBe(0)
  })

  it('a perfect no-combo run earns 3 stars on every level', () => {
    for (const l of levels) {
      expect(computeStars(l.maxScore, l.maxScore, l.starThresholds), l.id).toBe(3)
    }
  })
})
