import type { BiomeDefinition } from '@/levels/environments/shared/types'
import { PARTICLE_PRESETS } from '@/levels/environments/shared/particlePresets'
import { COLOR_RAMP, HERO_SHOT } from './config'
import { createAsphaltMaterial } from './cityShaders'
import Decorations from './Decorations'
import { trackExtent } from '@/levels/environments/shared/trackScatter'
import { DRONE_CLEARANCE } from '@/entities/enemies/hoverDroneMotion'
import { cityTowers, clearOfTowers, onPavement } from './cityLayout'
import { buildTrackIndex } from '@/levels/environments/shared/trackClearance'
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
    return (p, eyesSeeing) => clearOfTowers(towers, p, groundFn(p.x, p.z), DRONE_CLEARANCE, eyesSeeing)
  },
  // Its ground enemies are billboard bots (#963): each trackside spot moves onto the nearby pavement the rider sees best
  clearGround: (_groundFn, track) => {
    const towers = cityTowers(track, trackExtent(track))
    const index = buildTrackIndex(track)
    return (p, eyesSeeing) => onPavement(towers, index, p, eyesSeeing)
  },
  hero: HERO_SHOT,
}
