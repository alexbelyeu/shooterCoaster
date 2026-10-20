import type { BiomeType } from '@/types/level'
import type { BiomeDefinition } from './shared/types'
import { themePark } from './biomes/themePark'
import { desert } from './biomes/desert'
import { ocean } from './biomes/ocean'
import { arctic } from './biomes/arctic'
import { volcanic } from './biomes/volcanic'

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
}
