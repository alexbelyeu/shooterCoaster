import { describe, expect, it } from 'vitest'
import { getLevelConfig } from '@/levels/LevelRegistry'
import type { SplineTrackParams, TrackParams } from '@/types/level'
import { roundNumbers, roundPoints, type RidePrecision } from './rideData'
import { PARK_LEVEL_TRACK } from './environments/biomes/themePark/parkLevel'
import { PARK_TRACK } from './environments/biomes/themePark/parkTrack'
import { ARCTIC_LEVEL_TRACK } from './environments/biomes/arctic/arcticLevel'
import { ARCTIC_TRACK } from './environments/biomes/arctic/arcticTrack'
import { INFERNO_LEVEL_TRACK } from './environments/biomes/volcanic/infernoLevel'
import { INFERNO_TRACK } from './environments/biomes/volcanic/infernoTrack'
import { GYM_LEVEL_TRACK } from './environments/biomes/gym/gymLevel'
import { GYM_TRACK } from './environments/biomes/gym/gymTrack'

const KIT: RidePrecision = { position: 0, up: 2 }

// The generated rides, as the level registry takes them: plain numbers from `scripts/gen-ride-levels.mjs`, at the precision
// its `RIDES` table gives each.
describe.each([
  ['level1', PARK_LEVEL_TRACK, PARK_TRACK, KIT],
  ['level4', ARCTIC_LEVEL_TRACK, ARCTIC_TRACK, KIT],
  ['level5', INFERNO_LEVEL_TRACK, INFERNO_TRACK, KIT],
  ['level6', GYM_LEVEL_TRACK, GYM_TRACK, { position: 2, up: 4 }],
] as [string, TrackParams, SplineTrackParams, RidePrecision][])('%s ride data', (id, shipped, built, precision) => {
  it(`is the built ride (regenerate with \`node scripts/gen-ride-levels.mjs ${id}\`)`, () => {
    expect(shipped).toEqual({ ...roundNumbers(built), controlPoints: roundPoints(built.controlPoints, precision) })
  })

  it(`is what ${id} rides`, () => {
    expect(getLevelConfig(id)!.track).toBe(shipped)
  })
})
