import type { BiomeDefinition } from '@/levels/environments/shared/types'
import { PARTICLE_PRESETS } from '@/levels/environments/shared/particlePresets'
import { COLOR_RAMP, TEMPLE, TEMPLE_HEIGHT, TREES } from './config'
import Decorations from './Decorations'
import Features from './Features'

/** Jungle Ruins (level8, #870): wooded hills on the shared noise terrain, the stepped temple its hero. */
export const jungle: BiomeDefinition = {
  colorRamp: COLOR_RAMP,
  trees: TREES,
  Decorations,
  Features,
  particles: PARTICLE_PRESETS.jungleSpores,
  hero: { x: TEMPLE.x, z: TEMPLE.z, ground: TEMPLE.ground, focus: TEMPLE_HEIGHT * 0.45, orbitRadius: 820, orbitHeight: 360 },
}
