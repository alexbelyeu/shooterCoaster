import type { BiomeType } from '@/types/level'
import type { GradeConfig } from '@/canvas/post/colourGrade'
import type { AerialFogConfig } from './shared/aerialFog'

/**
 * Per-biome atmosphere: sky dome gradient, sun, ambient (hemisphere) light,
 * fog distances and the post colour grade (`ColourGradeEffect`: exposure, white
 * balance, split tone, contrast, saturation, vignette).
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
  /** scene.environmentIntensity of the baked sky env map (Standard/Physical materials only) */
  envIntensity: number
  /** Colour grade applied before ACES tone mapping (includes exposure) */
  grade: GradeConfig
  /** Puts the composer's `HeatShimmerEffect` in for this biome: it has a fire that aims it (the gym's Flame, #627). */
  heatShimmer?: boolean
  /** How hard the biome's own lamps burn (bulbs, lit cabins), 0 or absent by day: a night preset sets it (#829). */
  lampGlow?: number
  /** Scales every enemy's rim light (`setRimLift`), 1 or absent by day: a night preset lifts it so enemies read (#829). */
  enemyRimLift?: number
  /** The fog's tint towards and away from the sun (`shared/aerialFog.ts`, #836); absent derives it from the sky. */
  aerialFog?: AerialFogConfig
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
    envIntensity: 0.5,
    // Sunny and punchy: a touch warm, crisp contrast, lively colour
    grade: {
      exposure: 1.0,
      temperature: 0.08,
      tint: 0,
      shadowTint: 0x4a78c8,
      highlightTint: 0xffd49a,
      splitTone: 0.2,
      contrast: 1.06,
      saturation: 1.05,
      vibrance: 0.25,
      vignette: 0.32,
    },
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
    envIntensity: 0.45,
    // Sun-baked: strong warm balance, teal in the shade, bleached highlights
    grade: {
      exposure: 0.8,
      temperature: 0.22,
      tint: 0.03,
      shadowTint: 0x2e7c8a,
      highlightTint: 0xffb46a,
      splitTone: 0.35,
      contrast: 1.1,
      saturation: 0.95,
      vibrance: 0.15,
      vignette: 0.36,
    },
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
    envIntensity: 0.5,
    // Cool and clear: blue-green balance, deep blue shadows, rich water colour
    grade: {
      exposure: 1.0,
      temperature: -0.1,
      tint: -0.04,
      shadowTint: 0x1e4ea8,
      highlightTint: 0xfff0d0,
      splitTone: 0.25,
      contrast: 1.04,
      saturation: 1.08,
      vibrance: 0.3,
      vignette: 0.3,
    },
  },
  // Pale cold blue, violet horizon, low weak sun
  arctic: {
    sky: {
      zenith: 0x34508e, // dark enough for the additive aurora to read
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
    envIntensity: 0.45,
    // Cold and pale: blue balance, violet shadows, gentle contrast, muted colour
    grade: {
      exposure: 0.85,
      temperature: -0.2,
      tint: 0.04,
      shadowTint: 0x5a4ab8,
      highlightTint: 0xe6f0ff,
      splitTone: 0.3,
      contrast: 0.97,
      saturation: 0.9,
      vibrance: 0.1,
      vignette: 0.3,
    },
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
    // The ash sky is near-black: reflections only pick up the red horizon
    envIntensity: 0.6,
    // Hellish: warm balance, ember highlights over cooler ash shadows. The scene sits
    // mostly below mid grey, so exposure is lifted and contrast kept low to keep the terrain readable
    grade: {
      exposure: 1.15,
      temperature: 0.12,
      tint: 0,
      shadowTint: 0x3a5a7a,
      highlightTint: 0xff8a3a,
      splitTone: 0.2,
      contrast: 1.04,
      saturation: 1.05,
      vibrance: 0.15,
      vignette: 0.36,
    },
    // No sun glow in the ash sky, but the haze still burns orange towards the volcano's key light
    aerialFog: { strength: 0.6 },
  },
  // Climbing Gym (#517), an interior: the dome is never seen (the hall's ceiling covers it) but bakes the walls'
  // reflections. Bushwick-dim since #593: the "sun" is cool daylight slanting in from the high windows, the hemisphere
  // a dim cool-over-warm-dark fill, and the strip lights' warm pools come from the grime shader; fog is the hall's
  // dusty brown-grey air, so the far wall settles back without vanishing.
  gym: {
    sky: {
      zenith: 0x4a4d52,
      horizon: 0x4a4844,
      ground: 0x2a2826,
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
    // Low and moody (#593), a step brighter since #666 so walls, holds and enemies read on a phone: cool daylight
    // slanting in from the high windows, a dim warm-floored fill; the strip-light fixtures' warm pools come from
    // the hall's grime shader (`biomes/gym/grimeShader.ts`).
    sunLightColor: 0xbcd2ee,
    sunLightIntensity: 1.1,
    hemiSkyColor: 0x8d9aac,
    hemiGroundColor: 0x4a3e33,
    hemiIntensity: 1.05,
    // The hall's haze at its size (GYM_SCALE 48, #761): a dusty brown-grey that swallows the far end a little.
    fogNear: 2100,
    fogFar: 16500,
    envIntensity: 0.28,
    // Gritty: teal shadows, sodium-warm highlights, more contrast, a heavy vignette; holds still vivid
    grade: {
      exposure: 1.1,
      temperature: 0.05,
      tint: 0,
      shadowTint: 0x2f5560,
      highlightTint: 0xffc890,
      splitTone: 0.3,
      contrast: 1.15,
      saturation: 1.0,
      vibrance: 0.35,
      vignette: 0.42,
    },
    heatShimmer: true,
  },
  // Neon Metropolis (#323): a city at night. Deep indigo overhead, a faint warm sodium haze at the horizon (the
  // fog), a few stars and no sun disc; a cool moonlit key, a low violet fill. The towers' windows and the neon
  // signs carry the light (`biomes/city/`); the grade splits cool shadows from magenta / cyan highlights.
  city: {
    sky: {
      zenith: 0x05061a,
      horizon: 0x3a2a48,
      ground: 0x120c1c,
      horizonFalloff: 0.7,
      sunColor: 0xc8d4ff,
      sunSize: 0,
      sunGlow: 0,
      cloudiness: 0.25,
      cloudColor: 0x2a1e3e,
      cloudSpeed: 3,
      cloudStretch: 2,
    },
    sunDirection: [-0.35, 0.65, -0.6],
    sunLightColor: 0x9ab0ff,
    sunLightIntensity: 0.8,
    hemiSkyColor: 0x7a7ad0,
    hemiGroundColor: 0x40284a,
    hemiIntensity: 0.95,
    fogNear: 300,
    fogFar: 4600,
    // The wet street and glossy towers pick the haze and the signs' colour out of the baked sky
    envIntensity: 0.7,
    grade: {
      exposure: 1.12,
      temperature: -0.06,
      tint: 0.04,
      shadowTint: 0x2a3a9a,
      highlightTint: 0xff5ac8,
      splitTone: 0.32,
      contrast: 1.1,
      saturation: 1.12,
      vibrance: 0.35,
      vignette: 0.44,
    },
    lampGlow: 1,
    enemyRimLift: 2.5,
    aerialFog: { strength: 0 },
  },
  // Jungle Ruins (#870): a humid morning, the sun hazy gold over steaming hills. The pale green-white horizon is the
  // fog, close enough that the temple on its terrace stands half-veiled, a silhouette in the haze; teal in the
  // shadows, gold in the light.
  jungle: {
    sky: {
      zenith: 0x3f7f9c,
      horizon: 0xc9d8bf,
      ground: 0x7c9270,
      horizonFalloff: 0.55,
      sunColor: 0xfff0c4,
      sunSize: 0.03,
      sunGlow: 0.75,
      cloudiness: 0.55,
      cloudColor: 0xf2f5ea,
      cloudSpeed: 3,
      cloudStretch: 1.4,
    },
    sunDirection: [0.5, 0.5, -0.7],
    sunLightColor: 0xffe9b8,
    sunLightIntensity: 1.35,
    hemiSkyColor: 0xd8ead0,
    hemiGroundColor: 0x3f5a2a,
    hemiIntensity: 1.05,
    fogNear: 250,
    fogFar: 3900,
    envIntensity: 0.45,
    grade: {
      exposure: 1.02,
      temperature: 0.04,
      tint: -0.03,
      shadowTint: 0x2f6a5a,
      highlightTint: 0xffdf9a,
      splitTone: 0.2,
      contrast: 1.08,
      saturation: 1.08,
      vibrance: 0.25,
      vignette: 0.32,
    },
  },
}
