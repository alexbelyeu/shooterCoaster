import type { BiomeType } from '@/types/level'
import { createHeightFunction, type HeightFunction, type TrackSample } from '@/utils/terrainNoise'
import type { BiomeDefinition } from './shared/types'
import { themePark } from './biomes/themePark'
import { desert } from './biomes/desert'
import { ocean } from './biomes/ocean'
import { arctic } from './biomes/arctic'
import { volcanic } from './biomes/volcanic'
import { gym } from './biomes/gym'
import { city } from './biomes/city'

/**
 * Every biome's environment definition (terrain colours, trees, decorations,
 * landmarks/features). Adding a biome = a new folder under `biomes/` plus an
 * entry here; the `Record` type makes a missing biome a compile error.
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

/** A biome's ground, for every caller: an interior's authored `floor` as given, else the noise terrain kept off the track. */
export function biomeHeightFunction(biome: BiomeType, trackSamples?: TrackSample[]): HeightFunction {
  return BIOMES[biome].floor ?? createHeightFunction(biome, trackSamples)
}
