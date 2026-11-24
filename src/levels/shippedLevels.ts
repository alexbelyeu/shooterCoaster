import type { LevelRide, RiddenLevel } from '@/types/level'
import { getAllLevels, getLevelConfig } from './LevelRegistry'
import { DESERT_LEVEL_RIDE } from './environments/biomes/desert/desertLevel'
import { OCEAN_LEVEL_RIDE } from './environments/biomes/ocean/oceanLevel'
import { ARCTIC_LEVEL_RIDE } from './environments/biomes/arctic/arcticLevel'
import { INFERNO_LEVEL_RIDE } from './environments/biomes/volcanic/infernoLevel'
import { GYM_LEVEL_RIDE } from './environments/biomes/gym/gymLevel'

/**
 * Every level with its ride in hand, at once: for tests and the dev pages, never the game, which would carry every ride in
 * its startup JS (#960; `worlds.test.ts` holds the game to that). The rides the registry doesn't carry, as their worlds'
 * chunks hold them (`rideLevels.test.ts` checks the two agree).
 */
export const WORLD_RIDES: Readonly<Record<string, LevelRide>> = {
  level2: DESERT_LEVEL_RIDE,
  level3: OCEAN_LEVEL_RIDE,
  level4: ARCTIC_LEVEL_RIDE,
  level5: INFERNO_LEVEL_RIDE,
  level6: GYM_LEVEL_RIDE,
}

/** A shipped level and its ride. */
export function shippedLevel(id: string): RiddenLevel {
  const config = getLevelConfig(id)
  if (!config) throw new Error(`no level ${id}`)
  const { ride: own, ...level } = config
  const ride = own ?? WORLD_RIDES[id]
  if (!ride) throw new Error(`${id}: no ride in the registry or WORLD_RIDES`)
  return { ...level, ...ride }
}

/** Every shipped level and its ride, in order. */
export function shippedLevels(): RiddenLevel[] {
  return getAllLevels().map((l) => shippedLevel(l.id))
}
