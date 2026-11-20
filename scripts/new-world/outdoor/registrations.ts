import type { AtmosphereConfig } from '@/levels/environments/atmosphere'
import type { TerrainConfig } from '@/utils/terrainNoise'
import type { BIOME_REVERB as GAME_REVERB } from '@/audio/sfxDesign'
import type { BiomeType } from '@/types/level'

// The outdoor world's entries in the game's per-biome records: `npm run new-world` inserts each record's one entry
// into the record of the same name.

/** src/levels/environments/atmosphere.ts */
export const ATMOSPHERES: Record<string, AtmosphereConfig> = {
  // __NAME__ (scaffolded): a clear day, the look still to author (sky, sun, fog, grade)
  __BIOME__: {
    sky: {
      zenith: 0x2f6cc4,
      horizon: 0xbcd6ea,
      ground: 0x8fa8b8,
      horizonFalloff: 0.45,
      sunColor: 0xfff2d8,
      sunSize: 0.03,
      sunGlow: 0.5,
      cloudiness: 0.4,
      cloudColor: 0xffffff,
      cloudSpeed: 4,
      cloudStretch: 1,
    },
    sunDirection: [0.45, 0.6, -0.65],
    sunLightColor: 0xffe8c8,
    sunLightIntensity: 1.3,
    hemiSkyColor: 0xd6e8ff,
    hemiGroundColor: 0x55603a,
    hemiIntensity: 1.0,
    fogNear: 400,
    fogFar: 5200,
    envIntensity: 0.5,
    grade: {
      exposure: 1.0,
      temperature: 0.05,
      tint: 0,
      shadowTint: 0x4a78c8,
      highlightTint: 0xffd49a,
      splitTone: 0.15,
      contrast: 1.05,
      saturation: 1.05,
      vibrance: 0.2,
      vignette: 0.3,
    },
  },
}

/** src/utils/terrainNoise.ts */
export const BIOME_TERRAIN_CONFIGS: Record<string, TerrainConfig> = {
  __BIOME__: {
    frequency: 0.0008,
    amplitude: 450,
    octaves: 5,
    persistence: 0.45,
    lacunarity: 2.2,
    exponent: 1.4,
    ridgeMode: false,
    baseY: 0,
    flatRadius: 600,
    transitionWidth: 800,
    meshSize: 6000,
  },
}

/** src/audio/sfxDesign.ts */
export const BIOME_REVERB: Record<string, (typeof GAME_REVERB)[BiomeType]> = {
  __BIOME__: { seconds: 1.6, decayPow: 3.2, toneHz: 7000, level: 0.8 },
}
