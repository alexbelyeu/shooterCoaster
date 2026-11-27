import type { BiomeDefinition } from '../../shared/types'
import { PARTICLE_PRESETS } from '../../shared/particlePresets'
import { COLOR_RAMP, HALL_BOUNDS, gymFloor } from './config'
import Features from './Features'
import { FLAME_PERCH } from './flameFire'
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
  perch: FLAME_PERCH,
  // The Starr hangs on the hall's end wall: the orbit swings in front of it, inside the hall. The ride starts in the
  // station on the black path (#700): the tour reveals the pit from mid-hall, pulls back down the hall facing the
  // Starr to the south end (the landmark pass), then rides the last of the track into the station (`gymTrack.test.ts`).
  hero: {
    x: star.x, z: star.z, ground: 0, focus: star.y, orbitRadius: 20 * GYM_SCALE, orbitHeight: 9 * GYM_SCALE,
    arc: 0.7, facing: Math.atan2(STAR.facing.z, STAR.facing.x), approach: 8 * GYM_SCALE,
    tour: [
      { at: toWorld({ x: 30, y: 14, z: 30 }), look: toWorld({ x: 15, y: 5, z: 22 }) },
      { at: toWorld({ x: 68, y: 7, z: 13 }), look: star },
    ],
  },
}
