import type { BiomeDefinition } from '../../shared/types'
import { PARTICLE_PRESETS } from '../../shared/particlePresets'
import { COLOR_RAMP, SUNKEN_CITY_POSITION, TREES } from './config'
import Decorations from './Decorations'
import Features from './Features'
import { oceanLayout, seaObstacles } from './seaPlacement'

export const ocean: BiomeDefinition = {
  colorRamp: COLOR_RAMP,
  trees: TREES,
  Decorations,
  Features,
  particles: PARTICLE_PRESETS.oceanPlankton,
  // The sea stacks and breaching rocks: a shark's circle keeps out of them (`swimOrbit.ts`).
  keepOff: (groundFn, track) => seaObstacles(oceanLayout(groundFn, track)),
  hero: {
    x: SUNKEN_CITY_POSITION[0], z: SUNKEN_CITY_POSITION[2], ground: SUNKEN_CITY_POSITION[1],
    focus: 25, orbitRadius: 600, orbitHeight: 260,
  },
}
