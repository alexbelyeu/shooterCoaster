import { describe, expect, it } from 'vitest'
import { getAllLevels, getLevelConfig, previousLevel } from './LevelRegistry'
import { SCORE_VALUES, computeMaxScore, computeStars, nextStar } from './scoring'
import type { EnemyType } from '@/types/level'
import { BOSS_SPECS } from '@/entities/bosses/bossSpecs'
import { bossMaxScore } from '@/entities/bosses/bossModel'
import { ENTRY_SECONDS_MAX, RUN_SECONDS, pacingTimes } from './pacing'

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

  it('previousLevel inverts the nextLevel chain; only the first level has none', () => {
    expect(previousLevel(levels[0].id)).toBeNull()
    for (const l of levels) if (l.nextLevel) expect(previousLevel(l.nextLevel), l.nextLevel).toBe(l.id)
    expect(levels.filter((l) => previousLevel(l.id) === null).map((l) => l.id)).toEqual(['level1'])
    expect(previousLevel('nope')).toBeNull()
    expect(previousLevel('y', [{ id: 'x', nextLevel: 'y' }, { id: 'y', nextLevel: null }])).toBe('x')
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

  it('the finales and maxScores: Blimp 2675, Giant Scorpion 2450, Kraken 2624, Yeti 3180; Inferno ends on its drakes, 2234', () => {
    const finales = levels.map((l) => [l.id, l.boss?.type ?? l.enemies[l.enemies.length - 1].type, l.maxScore])
    expect(finales).toEqual([
      ['level1', 'goldenBlimp', 2675],
      ['level2', 'giantScorpion', 2450],
      ['level3', 'kraken', 2624],
      ['level4', 'yeti', 3180],
      ['level5', 'infernalDrake', 2234],
    ])
    expect(getLevelConfig('level1')!.maxScore).toBe(150 * 13 + bossMaxScore(BOSS_SPECS.goldenBlimp))
  })

  it.each(levels.map((l) => [l.id, l] as const))(
    '%s: waves from 0 s, the last one shootable by 35 s, then a 18–22 s boss fight (or a finale wave) ending the run',
    (_id, level) => {
      expect(RUN_SECONDS).toBe(60)
      const delays = level.enemies.map((w) => w.spawnDelay ?? 0)
      expect(delays[0]).toBe(0)
      expect([...delays].sort((a, b) => a - b)).toEqual(delays)
      const finaleAt = level.boss ? level.boss.at : delays[delays.length - 1]
      const waves = level.boss ? delays : delays.slice(0, -1)
      expect(Math.max(...waves) + ENTRY_SECONDS_MAX).toBeLessThanOrEqual(35)
      expect(finaleAt).toBe(pacingTimes().bossAt)
      expect(RUN_SECONDS - finaleAt).toBeGreaterThanOrEqual(18)
      expect(RUN_SECONDS - finaleAt).toBeLessThanOrEqual(22)
      if (level.boss) expect(level.boss.at - BOSS_SPECS[level.boss.type].tell.seconds).toBeGreaterThan(Math.max(...waves))
    },
  )

  it('one eruption in the Inferno, before the drakes', () => {
    const level5 = getLevelConfig('level5')!
    const eruptions = level5.enemies.filter((w) => w.isEruption)
    expect(eruptions).toHaveLength(1)
    expect(eruptions[0].spawnDelay!).toBeLessThan(pacingTimes().bossAt)
  })

  it('every level comes at 2–4 enemies a second of the waves before the finale; Theme Park, the bar, keeps its 50-balloon waves', () => {
    for (const l of levels) {
      const waves = l.boss ? l.enemies : l.enemies.slice(0, -1)
      const perSecond = waves.reduce((n, w) => n + w.count, 0) / pacingTimes().bossAt
      expect(perSecond, l.id).toBeGreaterThanOrEqual(2)
      expect(perSecond, l.id).toBeLessThanOrEqual(4)
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

  it('every level has at least one wave', () => {
    for (const l of levels) {
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
      'snowmanScout', 'snowmanBrute', 'emberWisp', 'lavaGolem', 'fireImp', 'infernalDrake', 'climber',
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

describe('nextStar', () => {
  const t = [0.3, 0.6, 0.9] as const
  it('names the next star and the points to it', () => {
    expect(nextStar(0, 1000, t)).toEqual({ stars: 1, points: 300 })
    expect(nextStar(299.5, 1000, t)).toEqual({ stars: 1, points: 1 })
    expect(nextStar(300, 1000, t)).toEqual({ stars: 2, points: 300 })
    expect(nextStar(899, 1000, t)).toEqual({ stars: 3, points: 1 })
  })

  it('does not round a float threshold product like 0.55 × 100 up a point', () => {
    expect(nextStar(54, 100, [0.25, 0.55, 0.85])).toEqual({ stars: 2, points: 1 })
  })

  it('is null with all stars or no max score', () => {
    expect(nextStar(900, 1000, t)).toBeNull()
    expect(nextStar(10, 0, t)).toBeNull()
  })

  it('agrees with computeStars at every whole score on every level', () => {
    for (const l of levels) {
      for (let score = 0; score <= l.maxScore; score++) {
        const earned = computeStars(score, l.maxScore, l.starThresholds)
        const next = nextStar(score, l.maxScore, l.starThresholds)
        if (earned === 3) {
          expect(next, `${l.id} @ ${score}`).toBeNull()
          continue
        }
        expect(next?.stars, `${l.id} @ ${score}`).toBe(earned + 1)
        expect(computeStars(score + next!.points, l.maxScore, l.starThresholds), `${l.id} @ ${score}`).toBe(earned + 1)
        expect(computeStars(score + next!.points - 1, l.maxScore, l.starThresholds), `${l.id} @ ${score}`).toBe(earned)
      }
    }
  })
})
