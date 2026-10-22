import type { BiomeDefinition } from '../../shared/types'
import { COLOR_RAMP, TREES } from './config'
import Decorations from './Decorations'
import Features from './Features'
import { createSandTerrainMaterial } from './sandRipples'

export const desert: BiomeDefinition = {
  colorRamp: COLOR_RAMP,
  trees: TREES,
  createTerrainMaterial: createSandTerrainMaterial,
  Decorations,
  Features,
}
