import { describe, expect, it } from 'vitest'
import { getAllLevels, getLevelConfig, previousLevel } from './LevelRegistry'
import { SCORE_VALUES, computeMaxScore, computeStars, nextStar, runNextStar, runStars, shownScore } from './scoring'
import type { EnemyType } from '@/types/level'
import { BOSS_SPECS } from '@/entities/bosses/bossSpecs'
import { bossMaxScore } from '@/entities/bosses/bossModel'
import { RUN_SECONDS, pacingTimes } from './pacing'
import { ENTRY_SECONDS_MAX } from '@/entities/spawning/spawnPlacement'

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

  it('the finales and maxScores: Blimp 2805, Giant Scorpion 3045, Kraken 3250, Yeti 4530, Magma Titan 3828, Medusa 3174, Helicopter 2055, Jungle Ruins (Blimp placeholder) 2615', () => {
    const finales = levels.map((l) => [l.id, l.boss?.type ?? l.enemies[l.enemies.length - 1].type, l.maxScore])
    expect(finales).toEqual([
      ['level1', 'goldenBlimp', 2805],
      ['level2', 'giantScorpion', 3045],
      ['level3', 'kraken', 3250],
      ['level4', 'yeti', 4530],
      ['level5', 'magmaTitan', 3828],
      ['level6', 'medusa', 3174],
      ['level7', 'helicopter', 2055],
      ['level8', 'goldenBlimp', 2615],
    ])
    expect(getLevelConfig('level1')!.maxScore).toBe(160 * 13 + bossMaxScore(BOSS_SPECS.goldenBlimp))
  })

  it("counts the hard route's wave in maxScore (#720): every wave and the boss, the gym's V8 rats included", () => {
    for (const l of levels) expect(l.maxScore, l.id).toBe(computeMaxScore(l.enemies, l.boss && BOSS_SPECS[l.boss.type]))
    expect(getLevelConfig('level6')!.enemies.filter((w) => w.route).map((w) => [w.type, w.count, w.route])).toEqual([['rat', 8, 'hard']])
  })

  it.each(levels.map((l) => [l.id, l] as const))(
    '%s: waves from 0 s, the last one shootable by 35 s, then a 18–28 s boss fight (or a finale wave) ending the run',
    (_id, level) => {
      expect(RUN_SECONDS).toBe(60)
      // A hard-route wave is timed by its junction, outside the waves every run meets.
      const delays = level.enemies.filter((w) => !w.route).map((w) => w.spawnDelay ?? 0)
      expect(delays[0]).toBe(0)
      expect([...delays].sort((a, b) => a - b)).toEqual(delays)
      const finaleAt = level.boss ? level.boss.at : delays[delays.length - 1]
      const waves = level.boss ? delays : delays.slice(0, -1)
      expect(Math.max(...waves) + ENTRY_SECONDS_MAX).toBeLessThanOrEqual(35)
      // The template's second, or sooner where a level's ride leaves the boss too little in view (level3, #1059).
      expect(finaleAt).toBeLessThanOrEqual(pacingTimes().bossAt)
      expect(RUN_SECONDS - finaleAt).toBeGreaterThanOrEqual(18)
      // Up to 28 s where the boss comes sooner (level2, #1059: the Giant Scorpion before the final lift turns the view away).
      expect(RUN_SECONDS - finaleAt).toBeLessThanOrEqual(28)
      if (level.boss) expect(level.boss.at - BOSS_SPECS[level.boss.type].tell.seconds).toBeGreaterThan(Math.max(...waves))
    },
  )

  it('one eruption wave in the Inferno, before the Magma Titan, whose tell is the final eruption', () => {
    const level5 = getLevelConfig('level5')!
    const eruptions = level5.enemies.filter((w) => w.isEruption)
    expect(eruptions).toHaveLength(1)
    expect(eruptions[0].spawnDelay!).toBeLessThan(pacingTimes().bossAt)
    expect(level5.boss?.type).toBe('magmaTitan')
    expect(level5.enemies.some((w) => w.type === 'infernalDrake')).toBe(true)
  })

  it('every level comes at 2–4 enemies a second of the waves before the finale', () => {
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
      'rat', 'dustBunny', 'lanternfly',
    ]
    for (const t of types) expect(Number.isInteger(SCORE_VALUES[t])).toBe(true)
  })

  it("scores the gym's pests (#515): a darting rat above a slow dust bunny, both small fry", () => {
    expect(SCORE_VALUES.rat).toBe(18)
    expect(SCORE_VALUES.dustBunny).toBe(12)
    expect(SCORE_VALUES.rat).toBeGreaterThan(SCORE_VALUES.dustBunny)
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

describe('runStars', () => {
  const level = { maxScore: 1000, starThresholds: [0.15, 0.55, 0.85] as [number, number, number] }

  it('scores the shown, rounded score: a fraction under a threshold that rounds onto it earns the star', () => {
    expect(shownScore(549.6)).toBe(550)
    expect(runStars(549.6, level)).toBe(2)
    expect(computeStars(549.6, level.maxScore, level.starThresholds)).toBe(1)
    expect(runStars(549.4, level)).toBe(1)
  })

  it('never shows a negative score', () => {
    expect(shownScore(-12.7)).toBe(0)
    expect(runStars(-12.7, level)).toBe(0)
  })
})

describe('runNextStar', () => {
  const level = { maxScore: 1000, starThresholds: [0.15, 0.55, 0.85] as [number, number, number] }

  it('asks for the star above the shown stars: 549.6 shows 2 stars, so the line asks for the third', () => {
    expect(runNextStar(549.6, level)).toEqual({ stars: 3, points: 300 })
    expect(runNextStar(549.4, level)).toEqual({ stars: 2, points: 1 })
    expect(runNextStar(849.6, level)).toBeNull()
  })

  it('agrees with runStars just under every threshold on every level', () => {
    for (const l of levels) {
      for (const t of l.starThresholds) {
        const score = Math.ceil(t * l.maxScore) - 0.4
        const stars = runStars(score, l)
        expect(runNextStar(score, l)?.stars ?? 4, `${l.id} @ ${score}`).toBe(stars + 1)
      }
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
      // One assertion per level after the loop (scripts/vitestAssertionBudget.ts): the first score that disagrees.
      let wrong: number | null = null
      for (let score = 0; score <= l.maxScore && wrong === null; score++) {
        const earned = computeStars(score, l.maxScore, l.starThresholds)
        const next = nextStar(score, l.maxScore, l.starThresholds)
        const agrees = earned === 3
          ? next === null
          : next?.stars === earned + 1 &&
            computeStars(score + next.points, l.maxScore, l.starThresholds) === earned + 1 &&
            computeStars(score + next.points - 1, l.maxScore, l.starThresholds) === earned
        if (!agrees) wrong = score
      }
      expect(wrong, `${l.id}: nextStar disagrees with computeStars at this score`).toBeNull()
    }
  })
})
