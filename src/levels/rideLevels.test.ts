import { describe, expect, it } from 'vitest'
import { getLevelConfig } from '@/levels/LevelRegistry'
import type { SplineTrackParams, TrackParams } from '@/types/level'
import { PARK_LEVEL_TRACK } from './environments/biomes/themePark/parkLevel'
import { PARK_TRACK } from './environments/biomes/themePark/parkTrack'
import { ARCTIC_LEVEL_TRACK } from './environments/biomes/arctic/arcticLevel'
import { ARCTIC_TRACK } from './environments/biomes/arctic/arcticTrack'

// The rides built from the ride kit, as the level registry takes them: plain numbers from `scripts/gen-ride-levels.mjs`.
describe.each([
  ['level1', PARK_LEVEL_TRACK, PARK_TRACK],
  ['level4', ARCTIC_LEVEL_TRACK, ARCTIC_TRACK],
] as [string, TrackParams, SplineTrackParams][])('%s ride data', (id, shipped, built) => {
  it('is the built ride (regenerate with `node scripts/gen-ride-levels.mjs`)', () => {
    // As the generator writes it: positions to whole units, ups to 2 decimals, the rest to 6 significant digits.
    const round = (_key: string, v: unknown) => (typeof v === 'number' ? Number(v.toPrecision(6)) : v)
    const fixed = (v: number) => Number(v.toFixed(2)) + 0
    const controlPoints = built.controlPoints.map((p) => ({
      x: Math.round(p.x) + 0,
      y: Math.round(p.y) + 0,
      z: Math.round(p.z) + 0,
      ...(p.up ? { up: { x: fixed(p.up.x), y: fixed(p.up.y), z: fixed(p.up.z) } } : {}),
    }))
    expect(shipped).toEqual({ ...JSON.parse(JSON.stringify(built, round)), controlPoints })
  })

  it(`is what ${id} rides`, () => {
    expect(getLevelConfig(id)!.track).toBe(shipped)
  })
})
