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
})
