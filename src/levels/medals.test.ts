import { describe, expect, it } from 'vitest'
import { getAllLevels } from './LevelRegistry'
import { RUN_SECONDS } from './pacing'
import { COMBO_TIERS, TOP_TIER } from '@/combat/comboTiers'
import type { LevelConfig } from '@/types/level'
import {
  LEVEL_MEDALS,
  LONGEST_COMBO_MEDAL,
  NO_RUN,
  featMet,
  medalsWon,
  type Medal,
  type MedalRun,
} from './medals'

const killable = (level: LevelConfig) => level.enemies.reduce((n, w) => n + w.count, 0)

/** A synthetic 60 s run that does exactly what the medal asks, within what the level offers; throws when it can't. */
function runFor(level: LevelConfig, { feat }: Medal): MedalRun {
  switch (feat.kind) {
    case 'goldens':
      if (feat.count > (level.goldenBalloons ?? 0)) throw new Error(`${level.id} has fewer than ${feat.count} golden balloons`)
      return { ...NO_RUN, goldens: feat.count, kills: feat.count }
    case 'boss': {
      if (!level.boss) throw new Error(`${level.id} has no boss`)
      const left = RUN_SECONDS - level.boss.at
      if (feat.seconds >= left) throw new Error(`${level.id}'s boss arrives with ${left} s to go, under the medal's ${feat.seconds} s`)
      return { ...NO_RUN, bossSeconds: feat.seconds }
    }
    case 'combo':
      if (feat.count > killable(level)) throw new Error(`${level.id} has fewer than ${feat.count} enemies`)
      return { ...NO_RUN, kills: feat.count, bestCombo: feat.count }
    case 'frenzyClean': {
      const frenzyAt = COMBO_TIERS[TOP_TIER].minCount
      if (frenzyAt > killable(level)) throw new Error(`${level.id} can't reach a Frenzy`)
      return { ...NO_RUN, kills: frenzyAt + 1, bestCombo: frenzyAt + 1, shotsFired: frenzyAt + 1, hits: frenzyAt + 1, frenzyShots: 1, frenzyHits: 1 }
    }
    case 'accuracy': {
      const hits = Math.ceil((feat.minShots * feat.percent) / 100)
      if (hits > killable(level)) throw new Error(`${level.id} has too few enemies for ${hits} hits`)
      return { ...NO_RUN, shotsFired: feat.minShots, hits, kills: hits }
    }
    case 'cleanRoute':
      if (!level.enemies.some((w) => w.route === 'hard')) throw new Error(`${level.id} has no hard route`)
      if (!level.enemies.some((w) => w.bystanders)) throw new Error(`${level.id} has no bystanders to spare`)
      return { ...NO_RUN, route: 'hard' }
  }
}

describe('medals', () => {
  for (const level of getAllLevels()) {
    describe(level.id, () => {
      const medals = LEVEL_MEDALS[level.id]

      it('has three medals with their own ids and names', () => {
        expect(medals).toHaveLength(3)
        expect(new Set(medals.map((m) => m.id)).size).toBe(3)
        expect(new Set(medals.map((m) => m.name)).size).toBe(3)
      })

      it('wins each medal with a synthetic 60 s run, and none from an idle one', () => {
        expect(medalsWon(level.id, NO_RUN)).toEqual([])
        for (const m of medals) expect(medalsWon(level.id, runFor(level, m))).toContain(m.id)
      })
    })
  }

  it('has no medals for an unknown level', () => {
    expect(Object.keys(LEVEL_MEDALS).sort()).toEqual(getAllLevels().map((l) => l.id).sort())
    expect(medalsWon('nowhere', { ...NO_RUN, bestCombo: 99 })).toEqual([])
  })

  it('wins nothing without a run (a daily)', () => {
    expect(medalsWon('level1', null)).toEqual([])
  })

  it('a chain of the longest combo medal wins every level a medal', () => {
    for (const level of getAllLevels()) expect(medalsWon(level.id, { ...NO_RUN, bestCombo: LONGEST_COMBO_MEDAL }).length).toBeGreaterThan(0)
  })

  it('reads each feat at its edge', () => {
    expect(featMet({ kind: 'boss', seconds: 12 }, { ...NO_RUN, bossSeconds: 12.01 })).toBe(false)
    expect(featMet({ kind: 'boss', seconds: 12 }, { ...NO_RUN, bossSeconds: null })).toBe(false)
    expect(featMet({ kind: 'combo', count: 20 }, { ...NO_RUN, bestCombo: 19 })).toBe(false)
    expect(featMet({ kind: 'goldens', count: 3 }, { ...NO_RUN, goldens: 2 })).toBe(false)
    expect(featMet({ kind: 'frenzyClean' }, { ...NO_RUN, frenzyShots: 3, frenzyHits: 2 })).toBe(false)
    expect(featMet({ kind: 'frenzyClean' }, NO_RUN)).toBe(false)
    const accuracy = { kind: 'accuracy', percent: 70, minShots: 30 } as const
    expect(featMet(accuracy, { ...NO_RUN, shotsFired: 30, hits: 21 })).toBe(true)
    expect(featMet(accuracy, { ...NO_RUN, shotsFired: 30, hits: 20 })).toBe(false)
    expect(featMet(accuracy, { ...NO_RUN, shotsFired: 10, hits: 10 })).toBe(false)
    expect(featMet({ kind: 'cleanRoute' }, { ...NO_RUN, route: 'hard', bystandersHit: 1 })).toBe(false)
    expect(featMet({ kind: 'cleanRoute' }, { ...NO_RUN, route: 'easy' })).toBe(false)
  })
})
