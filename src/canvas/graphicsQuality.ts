/**
 * Graphics quality presets (#35), pure for Node tests. `auto` renders like `high`
 * and lets `adaptiveDpr.ts` lower the pixel budget when frames run slow.
 */

export type GraphicsQuality = 'auto' | 'low' | 'medium' | 'high'

export const GRAPHICS_QUALITIES: readonly GraphicsQuality[] = ['auto', 'low', 'medium', 'high']

export interface QualityProfile {
  /** Cap on the canvas dpr (the pixel budget can lower it further). */
  maxDpr: number
  /** EffectComposer MSAA samples for mouse / touch screens. */
  multisampling: { fine: number; coarse: number }
  bloom: boolean
  /** Multiplier on ambient particle counts (`ParticleField`). */
  particleScale: number
  contactShadows: boolean
  /** Octaves of the procedural noise shaders' `fbm` (`FBM_OCTAVES` of `noiseGlsl.ts`' `fbm`: the Flame's fire, the volcano's smoke and lava); `fbmOctaves()` cuts it on touch. */
  fbmOctaves: number
}

export const QUALITY_PROFILES: Record<Exclude<GraphicsQuality, 'auto'>, QualityProfile> = {
  high: { maxDpr: 2, multisampling: { fine: 8, coarse: 4 }, bloom: true, particleScale: 1, contactShadows: true, fbmOctaves: 4 },
  medium: { maxDpr: 1.5, multisampling: { fine: 4, coarse: 2 }, bloom: true, particleScale: 0.75, contactShadows: true, fbmOctaves: 4 },
  low: { maxDpr: 1, multisampling: { fine: 0, coarse: 0 }, bloom: false, particleScale: 0.5, contactShadows: false, fbmOctaves: 3 },
}

export function qualityProfile(quality: GraphicsQuality): QualityProfile {
  return QUALITY_PROFILES[quality === 'auto' ? 'high' : quality] ?? QUALITY_PROFILES.high
}

/** The one rule for `FBM_OCTAVES` (#582): the quality's octaves, at most 3 on touch screens. */
export function fbmOctaves(profile: QualityProfile, coarsePointer: boolean): number {
  return coarsePointer ? Math.min(profile.fbmOctaves, 3) : profile.fbmOctaves
}

/** Share of a particle effect's full count to draw (the ambient fields, the Flame's tongues): the quality's `particleScale`, halved on touch screens. */
export function particleShare(coarsePointer: boolean, particleScale: number): number {
  return (coarsePointer ? 0.5 : 1) * particleScale
}

export function isGraphicsQuality(value: unknown): value is GraphicsQuality {
  return typeof value === 'string' && (GRAPHICS_QUALITIES as readonly string[]).includes(value)
}

/** `?quality=low` (any preset) from a location search string, else null. */
export function qualityFromQuery(search: string): GraphicsQuality | null {
  const value = new URLSearchParams(search).get('quality')
  return isGraphicsQuality(value) ? value : null
}
