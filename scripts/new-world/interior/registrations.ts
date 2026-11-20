import type { AtmosphereConfig } from '@/levels/environments/atmosphere'
import type { TerrainConfig } from '@/utils/terrainNoise'
import type { BiomeReverb } from '@/audio/sfxDesign'

// The interior world's entries in the game's per-biome records: `npm run new-world` inserts each record's one entry
// into the record of the same name.

/** src/levels/environments/atmosphere.ts */
export const ATMOSPHERES: Record<string, AtmosphereConfig> = {
  // __NAME__ (scaffolded interior): the dome only bakes the walls' reflections; the "sun" is the roof lights
  __BIOME__: {
    sky: {
      zenith: 0xdfe9f2,
      horizon: 0xc9d1d9,
      ground: 0x9aa2aa,
      horizonFalloff: 0.6,
      sunColor: 0xffffff,
      sunSize: 0,
      sunGlow: 0,
      cloudiness: 0,
      cloudColor: 0xffffff,
      cloudSpeed: 0,
      cloudStretch: 1,
    },
    sunDirection: [0.3, 1, 0.45],
    sunLightColor: 0xfff1dc,
    sunLightIntensity: 1.6,
    hemiSkyColor: 0xe4eefa,
    hemiGroundColor: 0x8a8f96,
    hemiIntensity: 1.35,
    fogNear: 900,
    fogFar: 6500,
    envIntensity: 0.45,
    grade: {
      exposure: 1.05,
      temperature: 0.03,
      tint: 0,
      shadowTint: 0x5a7aa8,
      highlightTint: 0xffe2b8,
      splitTone: 0.15,
      contrast: 1.08,
      saturation: 1.1,
      vibrance: 0.3,
      vignette: 0.25,
    },
  },
}

/** src/utils/terrainNoise.ts */
export const BIOME_TERRAIN_CONFIGS: Record<string, TerrainConfig> = {
  // __NAME__ draws its biome's `floor`, never noise: this only sizes the floor mesh.
  __BIOME__: {
    meshSize: 6000,
    authoredFloor: true,
  },
}

/** src/audio/sfxDesign.ts */
export const BIOME_REVERB: Record<string, BiomeReverb> = {
  __BIOME__: { seconds: 2.6, decayPow: 2.8, toneHz: 5000, level: 0.9 },
}
