import type { BiomeDefinition } from '../../shared/types'
import { PARTICLE_PRESETS } from '../../shared/particlePresets'
import { COLOR_RAMP, FORTRESS_SITE, TREES } from './config'
import Decorations from './Decorations'
import Features from './Features'

export const arctic: BiomeDefinition = {
  colorRamp: COLOR_RAMP,
  trees: TREES,
  Decorations,
  Features,
  particles: PARTICLE_PRESETS.arcticSnow,
  hero: { x: FORTRESS_SITE.x, z: FORTRESS_SITE.z, focus: 50, orbitRadius: 520, orbitHeight: 240 },
}
