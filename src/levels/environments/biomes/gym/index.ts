import type { BiomeDefinition } from '../../shared/types'
import { PARTICLE_PRESETS } from '../../shared/particlePresets'
import { COLOR_RAMP, HALL_BOUNDS, gymFloor } from './config'
import Features from './Features'
import { createGymFloorMaterial } from './grimeShader'
import { GYM_SCALE, STAR, toWorld } from './blockout'

const star = toWorld(STAR.centre)

/** The first interior (#517): Alex's climbing gym from his blockout, on the hall's floor with the Starr pit. */
export const gym: BiomeDefinition = {
  colorRamp: COLOR_RAMP,
  createTerrainMaterial: createGymFloorMaterial,
  trees: null,
  Features,
  particles: PARTICLE_PRESETS.gymChalk,
  floor: gymFloor,
  bounds: HALL_BOUNDS,
  // The Starr hangs on the hall's end wall: the orbit swings in front of it, inside the hall. The ride starts under
  // the Tree's trunk, so the swoop lands on the roots' front and rides the hairpin into the gap (`gymTrack.test.ts`).
  hero: {
    x: star.x, z: star.z, ground: 0, focus: star.y, orbitRadius: 20 * GYM_SCALE, orbitHeight: 9 * GYM_SCALE,
    arc: 0.7, facing: Math.atan2(STAR.facing.z, STAR.facing.x), approach: 12 * GYM_SCALE,
  },
}
