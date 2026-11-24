import type { BiomeType } from '@/types/level'
import type { HeightFunction, TrackSample } from '@/utils/terrainNoise'
import type { BiomeDefinition } from './shared/types'
import { groundOf } from './worlds'
import { themePark } from './biomes/themePark'
import { desert } from './biomes/desert'
import { ocean } from './biomes/ocean'
import { arctic } from './biomes/arctic'
import { volcanic } from './biomes/volcanic'
import { gym } from './biomes/gym'
import { city } from './biomes/city'

/**
 * Every biome's environment definition (terrain colours, trees, decorations, landmarks/features), for the tests and
 * the dev pages: the game reaches a biome only through its world chunk (`worlds.ts`, #862). Adding a biome = a new
 * folder under `biomes/` plus an entry here and in `WORLD_CHUNKS`; the `Record` type makes a missing biome a compile error.
 */
export const BIOMES: Record<BiomeType, BiomeDefinition> = {
  themePark,
  desert,
  ocean,
  arctic,
  volcanic,
  gym,
  city,
}

/** A biome's ground (`groundOf`), by name. */
export function biomeHeightFunction(biome: BiomeType, trackSamples?: TrackSample[]): HeightFunction {
  return groundOf(biome, BIOMES[biome], trackSamples)
}
