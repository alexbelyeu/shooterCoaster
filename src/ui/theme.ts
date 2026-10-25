import type { BiomeType } from '@/types/level'

/**
 * Small UI palette shared by the HUD, wave banner, results and level select.
 * Accents follow the per-biome art direction in docs/agents/VISION.md.
 */
export interface BiomeUITheme {
  /** Primary accent: wave banner rule, kill strip fill. */
  accent: string
  /** Glow colour (accent with alpha) for text-shadow / box-shadow. */
  glow: string
  /** Secondary accent: the landmark highlight on the level-select postcard. */
  accent2: string
  /** Sky gradient (CSS background) behind the level-select postcard. */
  bg: string
}

export const BIOME_UI: Record<BiomeType, BiomeUITheme> = {
  themePark: {
    accent: '#ff5cad', // candy pink
    glow: 'rgba(255, 92, 173, 0.55)',
    accent2: '#ffd23f',
    bg: 'linear-gradient(180deg, #2f8ff0 0%, #7fd0ff 62%, #ffe1f0 100%)',
  },
  desert: {
    accent: '#ffb347', // dune gold
    glow: 'rgba(255, 179, 71, 0.55)',
    accent2: '#d9532b',
    bg: 'linear-gradient(180deg, #f2793a 0%, #ffc070 58%, #ffe6ad 100%)',
  },
  ocean: {
    accent: '#2ee6d6', // lagoon teal
    glow: 'rgba(46, 230, 214, 0.55)',
    accent2: '#2a6fdb',
    bg: 'linear-gradient(180deg, #1b56b5 0%, #46b3e6 58%, #c4f4ff 100%)',
  },
  arctic: {
    accent: '#8fd3ff', // glacier blue
    glow: 'rgba(143, 211, 255, 0.55)',
    accent2: '#b48cff',
    bg: 'linear-gradient(180deg, #171f4a 0%, #45589f 55%, #b6d6ff 100%)',
  },
  volcanic: {
    accent: '#ff5a1f', // lava orange
    glow: 'rgba(255, 90, 31, 0.6)',
    accent2: '#ffc933',
    bg: 'linear-gradient(180deg, #110a0a 0%, #3a1410 55%, #9c2a10 100%)',
  },
}

export const DEFAULT_UI_THEME: BiomeUITheme = {
  accent: '#ffd23f',
  glow: 'rgba(255, 210, 63, 0.55)',
  accent2: '#ff8c00',
  bg: 'linear-gradient(180deg, #222 0%, #555 100%)',
}

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
