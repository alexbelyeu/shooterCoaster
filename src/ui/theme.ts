import type { BiomeType } from '@/types/level'

/**
 * Small UI palette shared by the HUD, wave banner and (later) level select.
 * Accents follow the per-biome art direction in docs/agents/VISION.md.
 */
export interface BiomeUITheme {
  /** Primary accent: wave banner rule, kill strip fill. */
  accent: string
  /** Glow colour (accent with alpha) for text-shadow / box-shadow. */
  glow: string
}

export const BIOME_UI: Record<BiomeType, BiomeUITheme> = {
  themePark: { accent: '#ff5cad', glow: 'rgba(255, 92, 173, 0.55)' }, // candy pink
  desert: { accent: '#ffb347', glow: 'rgba(255, 179, 71, 0.55)' }, // dune gold
  ocean: { accent: '#2ee6d6', glow: 'rgba(46, 230, 214, 0.55)' }, // lagoon teal
  arctic: { accent: '#8fd3ff', glow: 'rgba(143, 211, 255, 0.55)' }, // glacier blue
  volcanic: { accent: '#ff5a1f', glow: 'rgba(255, 90, 31, 0.6)' }, // lava orange
}

export const DEFAULT_UI_THEME: BiomeUITheme = { accent: '#ffd23f', glow: 'rgba(255, 210, 63, 0.55)' }

export function biomeTheme(biome: BiomeType | undefined | null): BiomeUITheme {
  return (biome && BIOME_UI[biome]) || DEFAULT_UI_THEME
}

/** HUD status colours. */
export const HUD_COLORS = {
  text: '#ffffff',
  gold: '#ffd23f',
  orange: '#ff9a1f',
  red: '#ff3b3b',
  amber: '#ffb020',
} as const

/** Combo colour by multiplier: white → gold → orange → red. */
export function comboColor(multiplier: number): string {
  if (multiplier >= 3.5) return HUD_COLORS.red
  if (multiplier >= 2.5) return HUD_COLORS.orange
  if (multiplier >= 1.5) return HUD_COLORS.gold
  return HUD_COLORS.text
}

/** Combo tier 0..3 for text sizing (matches comboColor thresholds). */
export function comboTier(multiplier: number): 0 | 1 | 2 | 3 {
  if (multiplier >= 3.5) return 3
  if (multiplier >= 2.5) return 2
  if (multiplier >= 1.5) return 1
  return 0
}
