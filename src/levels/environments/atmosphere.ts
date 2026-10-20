import type { BiomeType } from '@/types/level'

/**
 * Per-biome atmosphere: sky dome gradient, sun, ambient (hemisphere) light,
 * fog distances and tone-mapping exposure.
 *
 * Single source of truth: the scene fog colour is `sky.horizon`, so distant
 * terrain melts into the bottom of the dome with no seam. The directional
 * light and the sun disc on the dome share `sunDirection`.
 *
 * Colours are sRGB hex (THREE.Color converts them to linear working space).
 * Every new biome must define an entry here (DECISIONS.md 2026-10-19
 * "Procedural sky domes replace drei Sky").
 */
export interface SkyConfig {
  /** Colour straight up */
  zenith: number
  /** Colour at the horizon line — also the fog colour */
  horizon: number
  /** Colour below the horizon (only visible past the terrain edge) */
  ground: number
  /** How quickly the horizon colour gives way to the zenith (higher = thinner horizon band) */
  horizonFalloff: number
  /** Sun disc + glow colour */
  sunColor: number
  /** Angular radius of the sun disc in radians (0 = no disc) */
  sunSize: number
  /** Strength of the halo around the sun (0 = none) */
  sunGlow: number
  /** 0 = clear sky, 1 = overcast. Low-frequency fbm clouds / ash bands */
  cloudiness: number
  /** Cloud tint */
  cloudColor: number
  /** Cloud scroll speed (dome units per second) */
  cloudSpeed: number
  /** Stretch clouds along X (>1 = streaky bands, e.g. volcanic ash) */
  cloudStretch: number
}

export interface AtmosphereConfig {
  sky: SkyConfig
  /** Unit-ish direction *towards* the sun (normalised at use) */
  sunDirection: [number, number, number]
  /** Directional light colour / intensity (tints highlights) */
  sunLightColor: number
  sunLightIntensity: number
  /** Hemisphere light replaces the flat ambient light */
  hemiSkyColor: number
  hemiGroundColor: number
  hemiIntensity: number
  fogNear: number
  fogFar: number
  /** renderer.toneMappingExposure, consumed by the ACES ToneMapping effect */
  exposure: number
}

export const ATMOSPHERES: Record<BiomeType, AtmosphereConfig> = {
  // Bright blue sky, soft clouds, warm sun
  themePark: {
    sky: {
      zenith: 0x2a68d0,
      horizon: 0xb4d4ee,
      ground: 0x8fb0c8,
      horizonFalloff: 0.45,
      sunColor: 0xfff2d8,
      sunSize: 0.035,
      sunGlow: 0.55,
      cloudiness: 0.45,
      cloudColor: 0xffffff,
      cloudSpeed: 4,
      cloudStretch: 1,
    },
    sunDirection: [0.45, 0.6, -0.65],
    sunLightColor: 0xffe4bc,
    sunLightIntensity: 1.3,
    hemiSkyColor: 0xd6e8ff,
    hemiGroundColor: 0x55603a,
    hemiIntensity: 1.0,
    fogNear: 400,
    fogFar: 5200,
    exposure: 1.0,
  },
  // Warm hazy amber horizon, low orange sun, dusty blue overhead
  desert: {
    sky: {
      zenith: 0x7f9db6,
      horizon: 0xd9a06a,
      ground: 0xb88a5a,
      horizonFalloff: 0.7,
      sunColor: 0xffa860,
      sunSize: 0.045,
      sunGlow: 0.9,
      cloudiness: 0.15,
      cloudColor: 0xf0c89a,
      cloudSpeed: 6,
      cloudStretch: 3,
    },
    sunDirection: [0.75, 0.16, -0.62],
    sunLightColor: 0xffb478,
    sunLightIntensity: 1.2,
    hemiSkyColor: 0xffdcb0,
    hemiGroundColor: 0x6a4024,
    hemiIntensity: 0.85,
    fogNear: 200,
    fogFar: 6000,
    exposure: 0.8,
  },
  // Deep blue zenith to teal horizon
  ocean: {
    sky: {
      zenith: 0x0a3478,
      horizon: 0x48a8b4,
      ground: 0x1d5a66,
      horizonFalloff: 0.5,
      sunColor: 0xfff6e2,
      sunSize: 0.03,
      sunGlow: 0.6,
      cloudiness: 0.3,
      cloudColor: 0xe8f4ff,
      cloudSpeed: 5,
      cloudStretch: 1.5,
    },
    sunDirection: [0.2, 0.55, 0.8],
    sunLightColor: 0xfff2dc,
    sunLightIntensity: 1.1,
    hemiSkyColor: 0xbfe6ff,
    hemiGroundColor: 0x1e4a50,
    hemiIntensity: 0.95,
    fogNear: 200,
    fogFar: 5800,
    exposure: 1.0,
  },
  // Pale cold blue, violet horizon, low weak sun
  arctic: {
    sky: {
      zenith: 0x5a84c2,
      horizon: 0xb2a6d6,
      ground: 0x8a88b8,
      horizonFalloff: 0.55,
      sunColor: 0xfff0f4,
      sunSize: 0.03,
      sunGlow: 0.4,
      cloudiness: 0.25,
      cloudColor: 0xdfe4f6,
      cloudSpeed: 3,
      cloudStretch: 2,
    },
    sunDirection: [0.6, 0.22, 0.75],
    sunLightColor: 0xfff0e8,
    sunLightIntensity: 0.8,
    hemiSkyColor: 0xc4d2f0,
    hemiGroundColor: 0x4c4a78,
    hemiIntensity: 0.9,
    fogNear: 100,
    fogFar: 5500,
    exposure: 0.85,
  },
  // Dark ash sky with deep red underglow; no visible sun — the volcano dominates
  volcanic: {
    sky: {
      zenith: 0x0a0809,
      horizon: 0x4a1006,
      ground: 0x240804,
      horizonFalloff: 1.6,
      sunColor: 0x000000,
      sunSize: 0,
      sunGlow: 0,
      cloudiness: 0.65,
      cloudColor: 0x2a1612,
      cloudSpeed: 10,
      cloudStretch: 3,
    },
    // Key light comes from the volcano (≈ [2400, h, -1500]) as a lava-orange glow
    sunDirection: [0.8, 0.3, -0.5],
    sunLightColor: 0xff7a3a,
    sunLightIntensity: 1.3,
    hemiSkyColor: 0x6a3428,
    hemiGroundColor: 0x3a0e04,
    hemiIntensity: 0.9,
    fogNear: 1,
    fogFar: 6000,
    exposure: 1.0,
  },
}
