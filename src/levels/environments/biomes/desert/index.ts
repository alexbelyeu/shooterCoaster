import type { BiomeDefinition } from '../../shared/types'
import { PARTICLE_PRESETS } from '../../shared/particlePresets'
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
  particles: PARTICLE_PRESETS.desertDust,
}
