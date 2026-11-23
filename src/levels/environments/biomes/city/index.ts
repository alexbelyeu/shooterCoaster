import type { BiomeDefinition } from '@/levels/environments/shared/types'
import { PARTICLE_PRESETS } from '@/levels/environments/shared/particlePresets'
import { COLOR_RAMP, LANDMARK_SITE, SPIRE_HEIGHT } from './config'
import { createAsphaltMaterial } from './cityShaders'
import Decorations from './Decorations'
import { trackExtent } from '@/levels/environments/shared/trackScatter'
import { DRONE_CLEARANCE } from '@/entities/enemies/hoverDroneMotion'
import { cityTowers, clearOfTowers } from './cityLayout'
import Features from './Features'

/** Neon Metropolis (level7, #323): a night city on a flat street grid; towers, neon and a hero spire. */
export const city: BiomeDefinition = {
  colorRamp: COLOR_RAMP,
  trees: null,
  createTerrainMaterial: createAsphaltMaterial,
  Decorations,
  Features,
  particles: PARTICLE_PRESETS.cityDrizzle,
  // Its air enemies are hover drones: each spot clears the towers by the drone's drift
  clearAir: (groundFn, track) => {
    const towers = cityTowers(track, trackExtent(track))
    return (p) => clearOfTowers(towers, p, groundFn(p.x, p.z), DRONE_CLEARANCE)
  },
  hero: { x: LANDMARK_SITE.x, z: LANDMARK_SITE.z, focus: SPIRE_HEIGHT * 0.45, orbitRadius: 700, orbitHeight: 360 },
}
