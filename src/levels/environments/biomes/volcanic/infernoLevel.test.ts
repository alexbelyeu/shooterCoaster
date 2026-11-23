import { describe, expect, it } from 'vitest'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { INFERNO_LEVEL_TRACK } from './infernoLevel'
import { INFERNO_TRACK } from './infernoTrack'

describe('inferno level data', () => {
  it('is the built ride (regenerate with `node scripts/gen-inferno-level.mjs`)', () => {
    // As the generator writes it: positions to whole units, ups to 2 decimals, the rest to 6 significant digits.
    const round = (_key: string, v: unknown) => (typeof v === 'number' ? Number(v.toPrecision(6)) : v)
    const fixed = (v: number) => Number(v.toFixed(2)) + 0
    const controlPoints = INFERNO_TRACK.controlPoints.map((p) => ({
      x: Math.round(p.x) + 0,
      y: Math.round(p.y) + 0,
      z: Math.round(p.z) + 0,
      ...(p.up ? { up: { x: fixed(p.up.x), y: fixed(p.up.y), z: fixed(p.up.z) } } : {}),
    }))
    expect(INFERNO_LEVEL_TRACK).toEqual({ ...JSON.parse(JSON.stringify(INFERNO_TRACK, round)), controlPoints })
  })

  it('is what level 5 rides', () => {
    expect(getLevelConfig('level5')!.track).toBe(INFERNO_LEVEL_TRACK)
  })
})
