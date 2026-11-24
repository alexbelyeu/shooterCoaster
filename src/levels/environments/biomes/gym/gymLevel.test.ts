import { describe, expect, it } from 'vitest'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { roundNumbers } from '@/levels/rideData'
import { GYM_LEVEL_WALLS } from './gymLevel'
import { GYM_WALLS } from './walls'

// Level 6's track is checked with the other generated rides (`src/levels/rideLevels.test.ts`); its walls ship beside it.
describe('gym level walls', () => {
  it('are the blockout’s walls (regenerate with `node scripts/gen-ride-levels.mjs level6`)', () => {
    expect(GYM_LEVEL_WALLS).toEqual(roundNumbers(GYM_WALLS))
  })

  it('are what level 6 climbs', () => {
    expect(getLevelConfig('level6')!.walls).toEqual(GYM_LEVEL_WALLS)
  })
})
