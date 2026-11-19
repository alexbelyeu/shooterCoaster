import type { BiomeDefinition } from '../../shared/types'
import { PARTICLE_PRESETS } from '../../shared/particlePresets'
import { COLOR_RAMP, TREES } from './config'
import Decorations from './Decorations'
import Features from './Features'
import { createSandTerrainMaterial } from './sandRipples'
import { PYRAMID } from './landmarks'
import { desertObstacles, layoutDesert } from './desertLayout'
import { PYRAMID_HEIGHT } from '../../landmarkDimensions'

export const desert: BiomeDefinition = {
  colorRamp: COLOR_RAMP,
  trees: TREES,
  createTerrainMaterial: createSandTerrainMaterial,
  Decorations,
  Features,
  particles: PARTICLE_PRESETS.desertDust,
  keepOff: (groundFn, track) => desertObstacles(layoutDesert(groundFn, track).mesas),
  hero: { x: PYRAMID.x, z: PYRAMID.z, focus: PYRAMID_HEIGHT * 0.4, orbitRadius: 1300, orbitHeight: 520 },
}
