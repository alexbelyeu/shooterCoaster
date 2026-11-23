import { describe, expect, it } from 'vitest'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { OCEAN_LEVEL_TRACK, OCEAN_SEA_ARCH as SHIPPED_ARCH } from './oceanLevel'
import { OCEAN_SEA_ARCH, OCEAN_TRACK } from './oceanTrack'

describe('ocean level data', () => {
  it('is the built ride (regenerate with `node scripts/gen-ocean-level.mjs`)', () => {
    // As the generator writes it: positions to whole units, ups to 2 decimals, the rest to 6 significant digits.
    const round = (_key: string, v: unknown) => (typeof v === 'number' ? Number(v.toPrecision(6)) : v)
    const fixed = (v: number) => Number(v.toFixed(2)) + 0
    const controlPoints = OCEAN_TRACK.controlPoints.map((p) => ({
      x: Math.round(p.x) + 0,
      y: Math.round(p.y) + 0,
      z: Math.round(p.z) + 0,
      ...(p.up ? { up: { x: fixed(p.up.x), y: fixed(p.up.y), z: fixed(p.up.z) } } : {}),
    }))
    expect(OCEAN_LEVEL_TRACK).toEqual({ ...JSON.parse(JSON.stringify(OCEAN_TRACK, round)), controlPoints })
  })

  it('is what level 3 rides, its sea arch with it', () => {
    expect(SHIPPED_ARCH).toEqual(OCEAN_SEA_ARCH)
    expect(getLevelConfig('level3')!.track).toBe(OCEAN_LEVEL_TRACK)
    expect(getLevelConfig('level3')!.environment.seaArch).toBe(SHIPPED_ARCH)
  })
})
