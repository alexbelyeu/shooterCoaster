import { describe, expect, it } from 'vitest'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { PARK_LEVEL_TRACK } from './parkLevel'
import { PARK_TRACK } from './parkTrack'

describe('park level data', () => {
  it('is the built ride (regenerate with `node scripts/gen-park-level.mjs`)', () => {
    // As the generator writes it: positions to whole units, ups to 2 decimals, the rest to 6 significant digits.
    const round = (_key: string, v: unknown) => (typeof v === 'number' ? Number(v.toPrecision(6)) : v)
    const fixed = (v: number) => Number(v.toFixed(2)) + 0
    const controlPoints = PARK_TRACK.controlPoints.map((p) => ({
      x: Math.round(p.x) + 0,
      y: Math.round(p.y) + 0,
      z: Math.round(p.z) + 0,
      ...(p.up ? { up: { x: fixed(p.up.x), y: fixed(p.up.y), z: fixed(p.up.z) } } : {}),
    }))
    expect(PARK_LEVEL_TRACK).toEqual({ ...JSON.parse(JSON.stringify(PARK_TRACK, round)), controlPoints })
  })

  it('is what level 1 rides', () => {
    expect(getLevelConfig('level1')!.track).toBe(PARK_LEVEL_TRACK)
  })
})
