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
  // The Ice Fortress: its side towers stand 55 out, 10 wide at the base.
  keepOff: () => [{ x: FORTRESS_SITE.x, z: FORTRESS_SITE.z, r: 80 }],
  hero: { x: FORTRESS_SITE.x, z: FORTRESS_SITE.z, focus: 50, orbitRadius: 600, orbitHeight: 240 },
}
