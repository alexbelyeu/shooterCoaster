import type { BiomeDefinition } from '../../shared/types'
import { PARTICLE_PRESETS } from '../../shared/particlePresets'
import { COLOR_RAMP, gymFloor } from './config'
import Features from './Features'

/** The first interior (#517): Alex's climbing gym from his blockout, on the hall's floor with the Starr pit. */
export const gym: BiomeDefinition = {
  colorRamp: COLOR_RAMP,
  trees: null,
  Features,
  particles: PARTICLE_PRESETS.gymChalk,
  floor: gymFloor,
}
