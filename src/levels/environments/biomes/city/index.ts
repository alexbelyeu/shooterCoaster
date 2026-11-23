import type { BiomeDefinition } from '@/levels/environments/shared/types'
import { PARTICLE_PRESETS } from '@/levels/environments/shared/particlePresets'
import { COLOR_RAMP, LANDMARK_SITE, SPIRE_HEIGHT, TREES } from './config'
import Decorations from './Decorations'
import Features from './Features'

/** Neon Metropolis (level7): an outdoor world on the shared noise terrain. */
export const city: BiomeDefinition = {
  colorRamp: COLOR_RAMP,
  trees: TREES,
  Decorations,
  Features,
  particles: PARTICLE_PRESETS.parkPollen,
  hero: { x: LANDMARK_SITE.x, z: LANDMARK_SITE.z, focus: SPIRE_HEIGHT * 0.5, orbitRadius: 500, orbitHeight: 260 },
}
