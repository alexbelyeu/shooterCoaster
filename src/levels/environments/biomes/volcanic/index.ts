import type { BiomeDefinition } from '../../shared/types'
import { COLOR_RAMP, TREES } from './config'
import Decorations from './Decorations'
import Features from './Features'
import { createLavaGlowSampler } from './lavaGlow'

export const volcanic: BiomeDefinition = {
  colorRamp: COLOR_RAMP,
  terrainGlow: { color: 0xff4a10, intensity: 0.45, sample: createLavaGlowSampler() },
  trees: TREES,
  Decorations,
  Features,
}
