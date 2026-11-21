import { describe, expect, it } from 'vitest'
import { campaignScoreLimits, scoreLimits } from '@/levels/scoreLimits'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { GOLDEN_BALLOON } from '@/levels/scoring'
import { LEVEL_LIMITS } from './levelLimits'

describe('api level limits', () => {
  it('match the game\'s scoring code (regenerate with `node scripts/gen-level-limits.mjs`)', () => {
    expect(LEVEL_LIMITS).toEqual(campaignScoreLimits())
  })

  it('allow every kill at 5× on Theme Park, its golden balloons included', () => {
    const level1 = getLevelConfig('level1')!
    expect(scoreLimits(level1).maxScore).toBe((level1.maxScore + 3 * GOLDEN_BALLOON.score) * 5)
  })

  it("allow the gym's hard route (#720): the V8's rats in its kills and its score", () => {
    const level6 = getLevelConfig('level6')!
    const v8 = level6.enemies.filter((w) => w.route === 'hard')
    expect(v8.length).toBe(1)
    const everyRun = level6.enemies.filter((w) => !w.route).reduce((n, w) => n + w.count, 0)
    const medusa = scoreLimits({ ...level6, enemies: [] }).maxKills
    expect(LEVEL_LIMITS.level6.maxKills).toBe(everyRun + v8[0].count + medusa)
    expect(LEVEL_LIMITS.level6.maxScore).toBe(level6.maxScore * 5)
  })
})
