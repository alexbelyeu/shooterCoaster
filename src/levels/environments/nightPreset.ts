import type { BiomeType } from '@/types/level'
import type { RideVariant } from '@/types/game'
import { ATMOSPHERES, type AtmosphereConfig } from './atmosphere'

/**
 * Night Ride presets (#829): a biome's atmosphere after dark, the whole of it (sky, moon, lights, fog, grade), so a
 * night run swaps one config and every reader of the atmosphere follows: the dome, its baked env map, the lights,
 * `combineFog`'s base fog and the post grade. A biome with no entry has no Night Ride.
 *
 * The moon is the sun slot (`sunDirection`, a small cool disc); the directional light stays strong enough, and the
 * hemisphere fill bright enough, for enemies to read against the dark sky. `lampGlow` lights the biome's own lamps, `enemyRimLift` brightens the enemies' edges.
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
  },
}

export function hasNightRide(biome: BiomeType): boolean {
  return NIGHT_ATMOSPHERES[biome] !== undefined
}

/** The atmosphere a run of `biome` draws: its night preset on a Night Ride that has one, else the biome's own. */
export function atmosphereFor(biome: BiomeType, variant: RideVariant): AtmosphereConfig {
  return (variant === 'night' && NIGHT_ATMOSPHERES[biome]) || ATMOSPHERES[biome]
}
