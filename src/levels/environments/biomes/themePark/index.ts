import type { BiomeDefinition } from '../../shared/types'
import { PARTICLE_PRESETS } from '../../shared/particlePresets'
import { COLOR_RAMP, TREES } from './config'
import Decorations from './Decorations'
import Features from './Features'
import { RIDES } from './parkSpec'

/** The park's biggest Ferris wheel. */
const ferrisWheel = RIDES.filter((r) => r.kind === 'ferrisWheel').reduce((a, b) => (b.radius > a.radius ? b : a))

export const themePark: BiomeDefinition = {
  colorRamp: COLOR_RAMP,
  trees: TREES,
  Decorations,
  Features,
  particles: PARTICLE_PRESETS.parkPollen,
  hero: { x: ferrisWheel.x, z: ferrisWheel.z, focus: ferrisWheel.radius, orbitRadius: 380, orbitHeight: 220 },
}
