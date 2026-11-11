import type { BiomeDefinition } from '../../shared/types'
import { PARTICLE_PRESETS } from '../../shared/particlePresets'
import { COLOR_RAMP } from './config'
import Decorations from './Decorations'
import Features from './Features'

/** The first interior (#457): a flat floor, and the hall (walls, ceiling, skylights) as its features. */
export const gym: BiomeDefinition = {
  colorRamp: COLOR_RAMP,
  trees: null,
  Decorations,
  Features,
  particles: PARTICLE_PRESETS.gymChalk,
}
