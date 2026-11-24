import type { BiomeType } from '@/types/level'
import type { RideVariant } from '@/types/game'
import { ATMOSPHERES, type AtmosphereConfig } from './atmosphere'

/**
 * Night Ride presets (#829): a biome's atmosphere after dark, the whole of it (sky, moon, lights, fog, grade), so a
 * night run swaps one config and every reader of the atmosphere follows: the dome, its baked env map, the lights,
 * `combineFog`'s base fog and the post grade. A biome with no entry has no Night Ride.
 *
 * The moon is the sun slot (`sunDirection`, a small cool disc); the directional light stays strong enough, and the
 * hemisphere fill bright enough, for enemies to read against the dark sky. `lampGlow` lights the biome's own lamps (the aurora, the lava, the gym's work lights in place of its house lights), `enemyRimLift` brightens the enemies' edges.
 */
export const NIGHT_ATMOSPHERES: Partial<Record<BiomeType, AtmosphereConfig>> = {
  // The fair after dark: deep blue sky, a high moon, the midway's bulbs and the wheels' cabins lit
  themePark: {
    sky: {
      zenith: 0x060a1f,
      horizon: 0x26305a,
      ground: 0x141a33,
      horizonFalloff: 0.55,
      sunColor: 0xe4ecff,
      sunSize: 0.022,
      sunGlow: 0.3,
      cloudiness: 0.3,
      cloudColor: 0x3a4570,
      cloudSpeed: 3,
      cloudStretch: 1.4,
    },
    // Where the day's sun is, so the balloons are lit on the same side the player sees them by day
    sunDirection: [0.45, 0.6, -0.65],
    sunLightColor: 0xa8bcff,
    sunLightIntensity: 0.85,
    hemiSkyColor: 0x9aa8e0,
    hemiGroundColor: 0x4a3a36,
    hemiIntensity: 1.0,
    fogNear: 300,
    fogFar: 4200,
    envIntensity: 0.3,
    // Moonlit: cool blue shadows, sodium-warm highlights from the bulbs, a heavier vignette
    grade: {
      exposure: 1.1,
      temperature: -0.08,
      tint: 0,
      shadowTint: 0x2a3c8a,
      highlightTint: 0xffc070,
      splitTone: 0.3,
      contrast: 1.08,
      saturation: 1.05,
      vibrance: 0.3,
      vignette: 0.44,
    },
    lampGlow: 1,
    enemyRimLift: 2.5,
    // The night's fog stays flat: no sunlit haze under a moon
    aerialFog: { strength: 0 },
  },
  // A cold moonlit dune sea: the moon where the day's sun sets, torches burning on the Pyramid
  desert: {
    sky: {
      zenith: 0x070b1c,
      horizon: 0x2a3352,
      ground: 0x1c2030,
      horizonFalloff: 0.6,
      sunColor: 0xe8eeff,
      sunSize: 0.026,
      sunGlow: 0.35,
      cloudiness: 0.12,
      cloudColor: 0x343c5c,
      cloudSpeed: 4,
      cloudStretch: 3,
    },
    sunDirection: [0.75, 0.3, -0.62],
    sunLightColor: 0xa4b8ec,
    sunLightIntensity: 0.85,
    hemiSkyColor: 0x8a9cd4,
    hemiGroundColor: 0x5a4632,
    hemiIntensity: 0.85,
    fogNear: 250,
    fogFar: 5000,
    envIntensity: 0.3,
    // Cold blue sand, the torches' amber in the highlights
    grade: {
      exposure: 1.1,
      temperature: -0.12,
      tint: 0,
      shadowTint: 0x24387a,
      highlightTint: 0xffb060,
      splitTone: 0.3,
      contrast: 1.08,
      saturation: 1.0,
      vibrance: 0.25,
      vignette: 0.44,
    },
    lampGlow: 1,
    enemyRimLift: 2.5,
    aerialFog: { strength: 0 },
  },
  // Open sea under a low moon: its path on the water ahead, the jellyfish glowing from inside
  ocean: {
    sky: {
      zenith: 0x040c22,
      horizon: 0x163a52,
      ground: 0x0a2430,
      horizonFalloff: 0.5,
      sunColor: 0xeef4ff,
      sunSize: 0.026,
      sunGlow: 0.4,
      cloudiness: 0.25,
      cloudColor: 0x2a4460,
      cloudSpeed: 4,
      cloudStretch: 1.5,
    },
    // The day's sun lowered, so its glint on the water stretches into a moon path
    sunDirection: [0.2, 0.22, 0.8],
    sunLightColor: 0xb0c8ff,
    sunLightIntensity: 0.85,
    hemiSkyColor: 0x8ab4e0,
    hemiGroundColor: 0x123844,
    hemiIntensity: 0.95,
    fogNear: 250,
    fogFar: 5000,
    envIntensity: 0.35,
    grade: {
      exposure: 1.1,
      temperature: -0.1,
      tint: -0.02,
      shadowTint: 0x1a3a8a,
      highlightTint: 0xd8f0ff,
      splitTone: 0.25,
      contrast: 1.06,
      saturation: 1.1,
      vibrance: 0.35,
      vignette: 0.44,
    },
    lampGlow: 1,
    enemyRimLift: 2.5,
    aerialFog: { strength: 0 },
  },
  // Polar night: a black-blue sky with the aurora burning brighter in it, the moon low where the day's sun hangs
  arctic: {
    sky: {
      zenith: 0x050a1e,
      horizon: 0x142240,
      ground: 0x121a30,
      horizonFalloff: 0.55,
      sunColor: 0xe8f0ff,
      sunSize: 0.024,
      sunGlow: 0.3,
      cloudiness: 0.15,
      cloudColor: 0x283452,
      cloudSpeed: 3,
      cloudStretch: 2,
    },
    sunDirection: [0.6, 0.22, 0.75],
    sunLightColor: 0xa8c0ff,
    sunLightIntensity: 0.7,
    // The snow holds the moonlight: a cool fill bright enough that the ice and the enemies keep their shapes
    hemiSkyColor: 0x88a8d8,
    hemiGroundColor: 0x2a3050,
    hemiIntensity: 0.85,
    fogNear: 200,
    fogFar: 4800,
    envIntensity: 0.3,
    // Blue snow, the aurora's green in the highlights
    grade: {
      exposure: 0.95,
      temperature: -0.12,
      tint: 0,
      shadowTint: 0x1e3a7a,
      highlightTint: 0xb8ffe0,
      splitTone: 0.3,
      contrast: 1.08,
      saturation: 1.0,
      vibrance: 0.25,
      vignette: 0.44,
    },
    // The aurora (`ArcticFeatures`)
    lampGlow: 1,
    enemyRimLift: 2.5,
    aerialFog: { strength: 0 },
  },
  // Black ash night: no red in the sky, the key light the volcano's and the fill coming up off the lava, which burns hotter
  volcanic: {
    sky: {
      zenith: 0x030203,
      // A low, deep red band, the lava's glow under the ash: the ridges and the volcano stand black against it
      horizon: 0x380200,
      ground: 0x140402,
      horizonFalloff: 1.2,
      sunColor: 0x000000,
      sunSize: 0,
      sunGlow: 0,
      cloudiness: 0.7,
      cloudColor: 0x2a0c06,
      cloudSpeed: 10,
      cloudStretch: 3,
    },
    sunDirection: [0.8, 0.3, -0.5],
    sunLightColor: 0xff6020,
    sunLightIntensity: 1.0,
    // Lit from below: the ground's half of the fill is the lava's orange, the sky's half near black
    hemiSkyColor: 0x2a1a20,
    hemiGroundColor: 0x7a2408,
    hemiIntensity: 0.75,
    fogNear: 1,
    fogFar: 5000,
    envIntensity: 0.45,
    grade: {
      exposure: 1.15,
      temperature: 0.14,
      tint: 0,
      shadowTint: 0x2a3a6a,
      highlightTint: 0xff7a2a,
      splitTone: 0.3,
      contrast: 1.1,
      saturation: 1.08,
      vibrance: 0.2,
      vignette: 0.46,
    },
    // The lava rivers (`VolcanicFeatures`)
    lampGlow: 1,
    enemyRimLift: 2.5,
    aerialFog: { strength: 0 },
  },
  // The Climbing Gym after hours, an interior with no sky to darken: moonlight through the high windows, the house
  // lights off and only the work lights' pools left (`GymFeatures`), the Flame still burning
  gym: {
    sky: {
      zenith: 0x101218,
      horizon: 0x121418,
      ground: 0x0c0b0a,
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
    sunLightColor: 0x8aa4d8,
    sunLightIntensity: 0.75,
    hemiSkyColor: 0x5a6680,
    hemiGroundColor: 0x2a2420,
    hemiIntensity: 0.75,
    fogNear: 2100,
    fogFar: 15000,
    envIntensity: 0.2,
    // Cold blue shadows, the work lights' and the fire's sodium in the highlights
    grade: {
      exposure: 1.12,
      temperature: -0.04,
      tint: 0,
      shadowTint: 0x1e3a5a,
      highlightTint: 0xffb070,
      splitTone: 0.35,
      contrast: 1.12,
      saturation: 1.0,
      vibrance: 0.35,
      vignette: 0.48,
    },
    heatShimmer: true,
    // The house lights going off (`GymFeatures`)
    lampGlow: 1,
    enemyRimLift: 2.5,
    aerialFog: { strength: 0 },
  },
}

export function hasNightRide(biome: BiomeType): boolean {
  return NIGHT_ATMOSPHERES[biome] !== undefined
}

/** The atmosphere a run of `biome` draws: its night preset on a Night Ride that has one, else the biome's own. */
export function atmosphereFor(biome: BiomeType, variant: RideVariant): AtmosphereConfig {
  return (variant === 'night' && NIGHT_ATMOSPHERES[biome]) || ATMOSPHERES[biome]
}
