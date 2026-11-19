import type { BiomeType } from '@/types/level'
import { createHeightFunction, type HeightFunction, type TrackSample } from '@/utils/terrainNoise'
import type { BiomeDefinition } from './shared/types'
import { themePark } from './biomes/themePark'
import { desert } from './biomes/desert'
import { ocean } from './biomes/ocean'
import { arctic } from './biomes/arctic'
import { volcanic } from './biomes/volcanic'
import { gym } from './biomes/gym'

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
}

/**
 * A biome's ground: an interior's authored `floor` as given (its track is laid round it), else the noise
 * terrain kept off the track. Every caller resolves the ground here, so none can miss the gym's pit.
 */
export function biomeHeightFunction(biome: BiomeType, trackSamples?: TrackSample[]): HeightFunction {
  return BIOMES[biome].floor ?? createHeightFunction(biome, trackSamples)
}
