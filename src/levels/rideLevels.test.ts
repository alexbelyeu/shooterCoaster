import { describe, expect, it } from 'vitest'
import { getAllLevels, getLevelConfig } from '@/levels/LevelRegistry'
import { shippedLevel, WORLD_RIDES } from '@/levels/shippedLevels'
import { levelRide, loadWorld, WORLD_CHUNKS } from '@/levels/environments/worlds'
import type { SplineTrackParams, TrackParams } from '@/types/level'
import { roundNumbers, roundPoints, type RidePrecision } from './rideData'
import { PARK_LEVEL_TRACK } from './environments/biomes/themePark/parkLevel'
import { PARK_TRACK } from './environments/biomes/themePark/parkTrack'
import { DESERT_LEVEL_TRACK } from './environments/biomes/desert/desertLevel'
import { DESERT_RIDE_YAW, DESERT_TRACK } from './environments/biomes/desert/desertTrack'
import { OCEAN_LEVEL_TRACK } from './environments/biomes/ocean/oceanLevel'
import { OCEAN_TRACK } from './environments/biomes/ocean/oceanTrack'
import { ARCTIC_LEVEL_TRACK } from './environments/biomes/arctic/arcticLevel'
import { ARCTIC_TRACK } from './environments/biomes/arctic/arcticTrack'
import { INFERNO_LEVEL_TRACK } from './environments/biomes/volcanic/infernoLevel'
import { INFERNO_TRACK } from './environments/biomes/volcanic/infernoTrack'
import { GYM_LEVEL_TRACK } from './environments/biomes/gym/gymLevel'
import { GYM_TRACK } from './environments/biomes/gym/gymTrack'
import { CITY_LEVEL_TRACK } from './environments/biomes/city/cityLevel'
import { CITY_TRACK } from './environments/biomes/city/cityTrack'
import { JUNGLE_LEVEL_TRACK } from './environments/biomes/jungle/jungleLevel'
import { JUNGLE_TRACK } from './environments/biomes/jungle/jungleTrack'

const KIT: RidePrecision = { position: 0, up: 2 }

// The generated rides, as the level registry takes them: plain numbers from `scripts/gen-ride-levels.mjs`, at the precision
// its `RIDES` table gives each, in the frame it is laid out in (`yaw`).
describe.each([
  ['level1', PARK_LEVEL_TRACK, PARK_TRACK, KIT, 0],
  ['level2', DESERT_LEVEL_TRACK, DESERT_TRACK, KIT, DESERT_RIDE_YAW],
  ['level3', OCEAN_LEVEL_TRACK, OCEAN_TRACK, KIT, 0],
  ['level4', ARCTIC_LEVEL_TRACK, ARCTIC_TRACK, KIT, 0],
  ['level5', INFERNO_LEVEL_TRACK, INFERNO_TRACK, KIT, 0],
  ['level6', GYM_LEVEL_TRACK, GYM_TRACK, { position: 2, up: 4 }, 0],
  ['level7', CITY_LEVEL_TRACK, CITY_TRACK, KIT, 0],
  ['level8', JUNGLE_LEVEL_TRACK, JUNGLE_TRACK, KIT, 0],
] as [string, TrackParams, SplineTrackParams, RidePrecision, number][])('%s ride data', (id, shipped, built, precision, yaw) => {
  it(`is the built ride (regenerate with \`node scripts/gen-ride-levels.mjs ${id}\`)`, () => {
    expect(shipped).toEqual({ ...roundNumbers(built), controlPoints: roundPoints(built.controlPoints, precision, yaw) })
  })

  it(`is what ${id} rides`, () => {
    expect(shippedLevel(id).track).toBe(shipped)
  })
})

// Where each ride is (#960): level 1's in the registry, the startup JS; the others in their worlds' chunks only.
describe('ride sources', () => {
  it('only level 1 and the hand-written trig tracks ride from the registry', () => {
    const inRegistry = getAllLevels().filter((l) => l.ride)
    expect(inRegistry.filter((l) => l.id !== 'level1' && l.ride!.track.curve === 'spline').map((l) => l.id)).toEqual([])
    expect(getLevelConfig('level1')!.ride).toBeDefined()
  })

  it.each(getAllLevels().map((l) => [l.id, l] as const))('%s: one ride, from the registry or its world, the one the tests sample', async (id, level) => {
    const { world } = await WORLD_CHUNKS[level.biome]()
    const fromWorld = world.rides?.[id]
    expect(!!level.ride !== !!fromWorld, 'exactly one of LevelConfig.ride and World.rides').toBe(true)
    expect(fromWorld).toBe(WORLD_RIDES[id])
    expect(Object.keys(world.rides ?? {}).filter((other) => getLevelConfig(other)?.biome !== level.biome)).toEqual([])
  })

  it('levelRide has a world\'s ride once its chunk has loaded through loadWorld, not before', async () => {
    expect(levelRide('level2')).toBeUndefined()
    await loadWorld('desert')
    expect(levelRide('level2')).toBe(WORLD_RIDES.level2)
    expect(levelRide('level1')).toBe(getLevelConfig('level1')!.ride)
  })
})
