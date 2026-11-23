import type { BiomeDefinition } from '@/levels/environments/shared/types'
import { PARTICLE_PRESETS } from '@/levels/environments/shared/particlePresets'
import { COLOR_RAMP, LANDMARK_SITE, SPIRE_HEIGHT } from './config'
import { createAsphaltMaterial } from './cityShaders'
import Decorations from './Decorations'
import Features from './Features'

/** Neon Metropolis (level7, #323): a night city on a flat street grid; towers, neon and a hero spire. */
export const city: BiomeDefinition = {
  colorRamp: COLOR_RAMP,
  trees: null,
  createTerrainMaterial: createAsphaltMaterial,
  Decorations,
  Features,
  particles: PARTICLE_PRESETS.cityDrizzle,
  hero: { x: LANDMARK_SITE.x, z: LANDMARK_SITE.z, focus: SPIRE_HEIGHT * 0.45, orbitRadius: 700, orbitHeight: 360 },
}
