import { describe, expect, it } from 'vitest'
import type { RailPoint } from '@/track/curves/SplineCurve'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { GYM_LEVEL } from './gymLevel'
import { GYM_TRACK } from './gymTrack'
import { GYM_WALLS } from './walls'

describe('gym level data', () => {
  it('is the blockout’s track and walls (regenerate with `node scripts/gen-gym-level.mjs`)', () => {
    const round = (_key: string, v: unknown) =>
      typeof v === 'number' ? Number((Math.abs(v) < 1e-9 ? 0 : v).toPrecision(6)) + 0 : v
    const fixed = (v: number, digits: number) => Number(v.toFixed(digits)) + 0
    const { track, walls } = JSON.parse(JSON.stringify({ track: GYM_TRACK, walls: GYM_WALLS }, round))
    const controlPoints = track.controlPoints.map((p: RailPoint) => {
      const q: RailPoint = { x: fixed(p.x, 2), y: fixed(p.y, 2), z: fixed(p.z, 2) }
      if (p.up) q.up = { x: fixed(p.up.x, 4), y: fixed(p.up.y, 4), z: fixed(p.up.z, 4) }
      return q
    })
    expect(GYM_LEVEL).toEqual({ track: { ...track, controlPoints }, walls })
  })

  it('is what level 6 rides', () => {
    const level6 = getLevelConfig('level6')!
    expect(level6.track).toBe(GYM_LEVEL.track)
    expect(level6.walls).toEqual(GYM_LEVEL.walls)
  })
})
