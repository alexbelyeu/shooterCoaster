import type { BiomeDefinition } from '../../shared/types'
import { COLOR_RAMP, TREES } from './config'
import Decorations from './Decorations'
import Features from './Features'

export const desert: BiomeDefinition = {
  colorRamp: COLOR_RAMP,
  trees: TREES,
  Decorations,
  Features,
}
