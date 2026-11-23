import { describe, expect, it } from 'vitest'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { GYM_LEVEL } from './gymLevel'
import { GYM_TRACK } from './gymTrack'
import { GYM_WALLS } from './walls'

describe('gym level data', () => {
  it('is the blockout’s track and walls (regenerate with `node scripts/gen-gym-level.mjs`)', () => {
    // As the generator writes it: every number to 6 significant digits.
    const round = (_key: string, v: unknown) => (typeof v === 'number' ? Number(v.toPrecision(6)) : v)
    expect(GYM_LEVEL).toEqual(JSON.parse(JSON.stringify({ track: GYM_TRACK, walls: GYM_WALLS }, round)))
  })

  it('is what level 6 rides', () => {
    const level6 = getLevelConfig('level6')!
    expect(level6.track).toBe(GYM_LEVEL.track)
    expect(level6.walls).toEqual(GYM_LEVEL.walls)
  })
})
