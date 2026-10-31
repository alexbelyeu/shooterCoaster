import type { BiomeDefinition } from '../../shared/types'
import { PARTICLE_PRESETS } from '../../shared/particlePresets'
import { COLOR_RAMP, TREES } from './config'
import Decorations from './Decorations'
import Features from './Features'

export const themePark: BiomeDefinition = {
  colorRamp: COLOR_RAMP,
  trees: TREES,
  Decorations,
  Features,
  particles: PARTICLE_PRESETS.parkPollen,
}
