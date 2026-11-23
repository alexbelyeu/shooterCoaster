import { describe, expect, it } from 'vitest'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { DESERT_LEVEL_TRACK } from './desertLevel'
import { DESERT_TRACK } from './desertTrack'

describe('desert level data', () => {
  it('is the built ride (regenerate with `node scripts/gen-ride-level.mjs`)', () => {
    // As the generator writes it: the rest to 6 significant digits; the points whole units in the ride's frame, ups to 2 decimals.
    const round = (_key: string, v: unknown) => (typeof v === 'number' ? Number(v.toPrecision(6)) : v)
    const { controlPoints, ...rest } = DESERT_LEVEL_TRACK as typeof DESERT_TRACK
    expect(rest).toEqual(JSON.parse(JSON.stringify({ ...DESERT_TRACK, controlPoints: undefined }, round)))
    expect(controlPoints.length).toBe(DESERT_TRACK.controlPoints.length)
    let worst = 0
    let worstUp = 0
    DESERT_TRACK.controlPoints.forEach((p, i) => {
      const q = controlPoints[i]
      worst = Math.max(worst, Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z))
      if (p.up || q.up) worstUp = Math.max(worstUp, Math.hypot(p.up!.x - q.up!.x, p.up!.y - q.up!.y, p.up!.z - q.up!.z))
    })
    expect(worst).toBeLessThan(1)
    expect(worstUp).toBeLessThan(0.01)
  })

  it('is what level 2 rides', () => {
    expect(getLevelConfig('level2')!.track).toBe(DESERT_LEVEL_TRACK)
  })
})
