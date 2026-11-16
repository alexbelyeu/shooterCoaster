import type { BiomeDefinition } from '../../shared/types'
import { PARTICLE_PRESETS } from '../../shared/particlePresets'
import { COLOR_RAMP, HALL_BOUNDS, gymFloor } from './config'
import Features from './Features'
import { createGymFloorMaterial } from './grimeShader'

/** The first interior (#517): Alex's climbing gym from his blockout, on the hall's floor with the Starr pit. */
export const gym: BiomeDefinition = {
  colorRamp: COLOR_RAMP,
  createTerrainMaterial: createGymFloorMaterial,
  trees: null,
  Features,
  particles: PARTICLE_PRESETS.gymChalk,
  floor: gymFloor,
  bounds: HALL_BOUNDS,
}
