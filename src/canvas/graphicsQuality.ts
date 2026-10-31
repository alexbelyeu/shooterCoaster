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
}

export const QUALITY_PROFILES: Record<Exclude<GraphicsQuality, 'auto'>, QualityProfile> = {
  high: { maxDpr: 2, multisampling: { fine: 8, coarse: 4 }, bloom: true, particleScale: 1, contactShadows: true },
  medium: { maxDpr: 1.5, multisampling: { fine: 4, coarse: 2 }, bloom: true, particleScale: 0.75, contactShadows: true },
  low: { maxDpr: 1, multisampling: { fine: 0, coarse: 0 }, bloom: false, particleScale: 0.5, contactShadows: false },
}

export function qualityProfile(quality: GraphicsQuality): QualityProfile {
  return QUALITY_PROFILES[quality === 'auto' ? 'high' : quality] ?? QUALITY_PROFILES.high
}

export function isGraphicsQuality(value: unknown): value is GraphicsQuality {
  return typeof value === 'string' && (GRAPHICS_QUALITIES as readonly string[]).includes(value)
}

/** `?quality=low` (any preset) from a location search string, else null. */
export function qualityFromQuery(search: string): GraphicsQuality | null {
  const value = new URLSearchParams(search).get('quality')
  return isGraphicsQuality(value) ? value : null
}
